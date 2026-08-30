# app/services/explainability/chat_service.py

import json
import logging
import re
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from google.genai import types
from app.services.explainability.common.llm_client import clients, MODEL_ID
from app.services.explainability.chatbot.chat_prompts import (
    DIAGNOSTIC_SYSTEM_PROMPT,
    DIAGNOSTIC_USER_PROMPT_TEMPLATE,
    CLINERA_MODEL_VERSION,
    THINKING_STEPS,
    THINKING_STEPS_SIMULATION,
)
from app.services.explainability.simulation.simulation_service import simulation_service
from app.services.explainability.rag.kb_loader import kb_loader
from app.services.explainability.rag.feature_scorer import score_standalone
from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self):
        # Guideline-backed FNA thresholds (ACR TI-RADS 2017)
        self.fna_thresholds = {
            3: 2.5,   # TR3: FNA if >= 2.5cm
            4: 1.5,   # TR4: FNA if >= 1.5cm
            5: 1.0    # TR5: FNA if >= 1.0cm
        }
        # Ensure KB is loaded
        if not kb_loader._loaded:
            kb_loader.load()

    async def get_prediction_context(self, prediction_id: str) -> Dict[str, Any]:
        """Fetch ground truth context for the scan."""
        res = supabase_admin.table("predictions").select("*").eq("id", prediction_id).single().execute()
        if not res.data:
            raise ValueError("Prediction not found")
        return res.data

    def _validate_response(self, text: str, ground_truth: Dict[str, Any]) -> List[str]:
        """
        3-Layer Semantic Validator:
        Layer 1: Numeric integrity (Points, Size)
        Layer 2: Terminology enforcement (Classification naming)
        Layer 3: Clinical logic validation (FNA thresholds)
        """
        errors = []

        # 1. Numeric check: Total Points
        features_data = ground_truth.get("features", {})
        target_pts = features_data.get("total_points")

        if target_pts is not None:
            matches = re.findall(r'(?:total|final|sum|of)\s*(?:of)?\s*(\d+)\s*points?', text, re.IGNORECASE)
            for m in matches:
                if int(m) != target_pts:
                    errors.append(f"Numeric Mismatch: AI mentioned a total of {m} points, but ground truth is {target_pts}.")

        # 2. Terminology: TR level
        target_tr = ground_truth.get("tirads")
        if target_tr:
            tr_matches = re.findall(r'TR(\d)', text)
            for m in tr_matches:
                if int(m) != target_tr:
                    errors.append(f"Terminology Mismatch: AI mentioned TR{m}, but actual is TR{target_tr}.")

        # 3. Clinical Logic: FNA rules
        if "fna" in text.lower() or "biopsy" in text.lower():
            size_mm = features_data.get("measurements", {}).get("nodule_max_diameter_mm") or \
                      features_data.get("measurements", {}).get("nodule_area_relative", 0) * 100
            threshold = self.fna_thresholds.get(target_tr)
            if threshold and size_mm < (threshold * 10):
                if re.search(r'fna\s+is\s+recommended', text, re.IGNORECASE):
                    errors.append(f"Clinical Logic Error: AI suggested FNA for a small TR{target_tr} nodule.")

        return errors

    async def log_audit_failure(self, prediction_id: str, context: Dict, output: str, errors: List[str]):
        """Logs validation failures for clinical audit."""
        try:
            supabase_admin.table("clinical_audit_logs").insert({
                "prediction_id": prediction_id,
                "input_context": context,
                "ai_raw_output": output,
                "validation_errors": errors,
                "model_version": MODEL_ID
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log clinical audit: {e}")

    async def _stream_thinking_steps(
        self, steps: list, is_simulation: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        Stream animated thinking steps over SSE.
        Each step fires a [THINKING_STEP] event — marking start, then done after a realistic delay.
        These steps correspond to REAL operations being performed.
        """
        total = len(steps)
        for s in steps:
            # Step starts
            yield f"data: [THINKING_STEP]:{json.dumps({'step': s['step'], 'total': total, 'label': s['label'], 'done': False})}\n\n"
            # Realistic processing delay — step 2 (KB retrieval) is longer
            delay = 0.4 if s["step"] == 2 else (0.6 if s["step"] == 3 else 0.25)
            await asyncio.sleep(delay)
            # Step done
            yield f"data: [THINKING_STEP]:{json.dumps({'step': s['step'], 'total': total, 'label': s['label'], 'done': True})}\n\n"
            await asyncio.sleep(0.05)

    async def generate_chat_stream(
        self,
        prediction_id: Optional[str],
        user_message: str,
        simulation_modifications: Optional[Dict] = None,
        features_input: Optional[Dict] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Field-level, schema-validated streaming response.
        Protocol:
          [THINKING_STEP] × N   ← reasoning theater (before LLM)
          [HEADER_INIT]         ← metadata hydration
          [FIELD_START/VALUE/DONE] × fields ← streamed report
        """
        # ── Determine context source ──────────────────────────────────────────
        is_standalone = features_input is not None and not prediction_id

        if is_standalone:
            # Standalone mode: score given features directly
            try:
                data = score_standalone(features_input)
                features_data = {
                    "clinical_features": data["clinical_features"],
                    "total_points": data["total_points"],
                    "measurements": {},
                }
                ground_truth_context = {
                    "tirads": data["tirads"],
                    "confidence": 1.0,
                    "features": features_data,
                }
                clinical_features = data["clinical_features"]
                tirads_level = data["tirads"]
                total_points = data["total_points"]
                kb_analysis_text = data.get("kb_analysis_text", "")
                kb_recommendation = data.get("kb_recommendation", "")
            except Exception as e:
                logger.error(f"Standalone scoring failed: {e}")
                yield "data: [FIELD_START]:error\n\n"
                yield "data: [FIELD_VALUE]:⚠️ Could not score the provided features. Please check your input.\n\n"
                yield "data: [FIELD_DONE]:error\n\n"
                return
        else:
            # Scan-linked mode: fetch from Supabase
            if not prediction_id:
                yield "data: [FIELD_START]:error\n\n"
                yield "data: [FIELD_VALUE]:⚠️ No prediction ID or features provided.\n\n"
                yield "data: [FIELD_DONE]:error\n\n"
                return
            try:
                data = await self.get_prediction_context(prediction_id)
            except Exception as e:
                logger.error(f"Context fetch failed: {e}")
                yield "data: [FIELD_START]:error\n\n"
                yield "data: [FIELD_VALUE]:⚠️ Could not load scan context. Please refresh.\n\n"
                yield "data: [FIELD_DONE]:error\n\n"
                return

            ground_truth_context = data
            features_data = data.get("features", {})
            total_points = features_data.get("total_points", 0)
            clinical_features = features_data.get("clinical_features", {})
            tirads_level = data.get("tirads", 0)

            # Retrieve KB text for this scan's features
            feature_values = {k: v.get("value", "") for k, v in clinical_features.items()}
            kb_analysis_text, kb_recommendation, _, _ = kb_loader.retrieve_kb_text(feature_values)

        # ── Detect if simulation is needed ────────────────────────────────────
        is_what_if = bool(simulation_modifications) or any(
            x in user_message.lower()
            for x in ["what if", "suppose", "assume", "change", "simulate", "if i change", "hypothetical"]
        )

        steps = THINKING_STEPS_SIMULATION if is_what_if else THINKING_STEPS

        # ── Step 1: Stream thinking steps (reasoning theater) ─────────────────
        async for event in self._stream_thinking_steps(steps, is_simulation=is_what_if):
            yield event

        # ── Step 2: Immediate Header Hydration ────────────────────────────────
        initial_metadata = {
            "confidence_score": data.get("confidence", 1.0) if is_standalone else data.get("confidence", 0.0),
            "model_version": CLINERA_MODEL_VERSION,
            "tirads_level": tirads_level,
            "total_points": total_points,
        }
        yield f"data: [HEADER_INIT]{json.dumps(initial_metadata)}\n\n"
        await asyncio.sleep(0.01)

        # ── Step 3: Simulation Logic ──────────────────────────────────────────
        simulation_result = None
        if is_what_if:
            if not simulation_modifications:
                try:
                    simulation_modifications = await self._detect_simulation_intent(
                        user_message, clinical_features
                    )
                except Exception as e:
                    logger.error(f"Simulation intent detection failed: {e}")

            if simulation_modifications:
                try:
                    simulation_result = simulation_service.run_simulation(
                        clinical_features, simulation_modifications
                    )
                    tirads_level = simulation_result["simulated"]["tirads"]
                    total_points = simulation_result["simulated"]["total_points"]

                    # Retrieve KB text for SIMULATED feature combination
                    sim_feature_values = {
                        k: v.get("value", "")
                        for k, v in simulation_result["simulated"].get("breakdown", {}).items()
                    }
                    kb_analysis_text, kb_recommendation, _, _ = kb_loader.retrieve_kb_text(sim_feature_values)
                except Exception as e:
                    logger.error(f"Simulation engine failed: {e}")

        # ── Step 4: Build Prompt ──────────────────────────────────────────────
        sim_context_str = json.dumps(simulation_result["simulated"]) if simulation_result else "None"
        features_summary = ", ".join(
            [f"{k}: {v.get('value')}" for k, v in clinical_features.items()]
        )

        user_prompt = DIAGNOSTIC_USER_PROMPT_TEMPLATE.format(
            tirads_level=tirads_level,
            total_points=total_points,
            features_list=features_summary,
            size_mm=features_data.get("measurements", {}).get("nodule_max_diameter_mm", "N/A"),
            simulation_data=sim_context_str,
            kb_analysis_text=kb_analysis_text or "Not available — using general ACR TI-RADS 2017 guidelines.",
            kb_recommendation=kb_recommendation or "See ACR TI-RADS 2017 for size-based thresholds.",
            user_message=user_message,
        )

        # ── Step 5: LLM Generation ────────────────────────────────────────────
        client = clients[0] if clients else None
        if not client:
            yield "data: [FIELD_START]:error\n\n"
            yield "data: [FIELD_VALUE]:⚠️ No API clients available.\n\n"
            yield "data: [FIELD_DONE]:error\n\n"
            return

        try:
            response = await client.aio.models.generate_content(
                model=MODEL_ID,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            raw_json = response.text.strip()
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raw_json = ""

        # ── Step 6: Schema Validation Gate ───────────────────────────────────
        report = None
        if raw_json:
            try:
                report = json.loads(raw_json)
                required_keys = ["metadata", "rationale", "scoring_breakdown", "guideline_reference"]
                if not all(k in report for k in required_keys):
                    logger.warning(f"Schema incomplete. Keys: {list(report.keys())}")
                    report = None
            except Exception as e:
                logger.error(f"JSON parse failed: {e}. Raw: {raw_json[:200]}")
                report = None

        if report is None:
            report = {
                "metadata": {
                    "confidence_score": data.get("confidence", 1.0),
                    "model_version": f"{CLINERA_MODEL_VERSION} (Fallback)",
                    "tirads_level": tirads_level,
                    "total_points": total_points,
                },
                "rationale": (
                    f"This nodule is classified as TI-RADS {tirads_level} with a total of "
                    f"{total_points} points per ACR TI-RADS 2017. {kb_analysis_text[:200] if kb_analysis_text else ''}"
                ),
                "scoring_breakdown": [],
                "simulation_impact": None,
                "guideline_reference": kb_recommendation or (
                    "ACR TI-RADS 2017: TR5 (≥7 pts) — FNA recommended if ≥1.0 cm."
                ),
            }

        # ── Step 7: Mandatory Override — verified scoring ─────────────────────
        # The LLM cannot override deterministic scores.
        verified_breakdown = []
        if simulation_result:
            source_features = simulation_result["simulated"].get("breakdown", {})
        else:
            source_features = clinical_features

        for feat, details in source_features.items():
            verified_breakdown.append({
                "feature": feat,
                "value": details.get("value", "—"),
                "points": details.get("points", 0),
                "description": details.get("description", ""),
            })

        report["scoring_breakdown"] = verified_breakdown
        report.setdefault("metadata", {})
        report["metadata"]["tirads_level"] = tirads_level
        report["metadata"]["total_points"] = total_points
        report["metadata"]["confidence_score"] = (
            data.get("confidence", 1.0) if is_standalone else data.get("confidence", 0.0)
        )

        # ── Step 8: Simulation Impact Override ───────────────────────────────
        if simulation_result:
            orig = simulation_result["original"]
            sim = simulation_result["simulated"]
            delt = simulation_result["delta"]
            modifications = delt.get("modifications", {})
            changes = [f"{feat}: {details.get('value', '?')}" for feat, details in modifications.items()]
            ai_sim = report.get("simulation_impact") or {}
            ai_delta = ai_sim.get("delta", {}) if isinstance(ai_sim, dict) else {}
            clinical_implication = (
                ai_delta.get("clinical_implication")
                or f"Changing {', '.join(changes)} shifts the total score from "
                   f"{orig['total_points']} to {sim['total_points']} points "
                   f"({'maintaining' if orig['tirads'] == sim['tirads'] else 'changing'} "
                   f"TI-RADS {orig['tirads']} → TR{sim['tirads']})."
            )
            report["simulation_impact"] = {
                "is_simulation": True,
                "changes": changes,
                "original": {"points": orig["total_points"], "tirads": orig["tirads"]},
                "modified": {"points": sim["total_points"], "tirads": sim["tirads"]},
                "delta": {
                    "points_change": delt["points_change"],
                    "clinical_implication": clinical_implication,
                },
            }
        else:
            report["simulation_impact"] = None

        # ── Step 9: Field-Level Event Dispatcher ──────────────────────────────
        fields_to_stream = ["rationale", "scoring_breakdown", "simulation_impact", "guideline_reference"]
        for field in fields_to_stream:
            value = report.get(field)
            if value is None:
                continue

            yield f"data: [FIELD_START]:{field}\n\n"

            if isinstance(value, str):
                for i in range(0, len(value), 60):
                    yield f"data: [FIELD_VALUE]:{value[i:i+60]}\n\n"
                    await asyncio.sleep(0.008)
            else:
                yield f"data: [FIELD_VALUE]:{json.dumps(value)}\n\n"

            yield f"data: [FIELD_DONE]:{field}\n\n"
            await asyncio.sleep(0.03)

    async def _detect_simulation_intent(
        self, message: str, features: Dict
    ) -> Optional[Dict]:
        """
        Uses LLM to extract structured simulation parameters from natural language.
        Returns exact class values from FEATURE_DEFINITIONS.
        """
        from app.models.xception_model import FEATURE_DEFINITIONS as FD

        client = clients[0] if clients else None
        if not client:
            return None

        valid_classes = {
            feat: FD[feat]["classes"]
            for feat in features.keys()
            if feat in FD
        }
        current_values = {k: v.get("value") for k, v in features.items()}

        system_prompt = f"""You are a clinical intent parser for a thyroid imaging system.
Extract a SINGLE feature modification from the user's hypothetical request.

STRICT RULES:
1. Return ONLY a valid JSON object: {{"feature_name": {{"value": "exact_class_value"}}}}
2. The "value" MUST be one of the allowed classes listed below. Do NOT invent values.
3. If no clear thyroid feature change is requested, return the string null.
4. NEVER return markdown, explanation, or any text outside the JSON.

ALLOWED FEATURE CLASSES (use these exact strings):
{json.dumps(valid_classes, indent=2)}

CURRENT VALUES:
{json.dumps(current_values, indent=2)}
"""
        try:
            response = await client.aio.models.generate_content(
                model=MODEL_ID,
                contents=[system_prompt, f"User Query: {message}"],
                config=types.GenerateContentConfig(temperature=0, max_output_tokens=150),
            )
            raw_text = response.text.strip().replace("```json", "").replace("```", "").strip()
            if not raw_text or raw_text.lower() == "null":
                logger.info("No simulation intent detected in message.")
                return None
            parsed = json.loads(raw_text)
            logger.info(f"🚀 Simulation Intent Detected: {parsed}")
            return parsed
        except Exception as e:
            logger.error(f"Intent detection failed: {e}")
            return None


chat_service = ChatService()
