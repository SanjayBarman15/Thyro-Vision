# app/services/explainability/chat_service.py

import json
import logging
import re
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from google.genai import types
from app.services.explainability.common.llm_client import clients, MODEL_ID
from app.services.explainability.chatbot.chat_prompts import DIAGNOSTIC_SYSTEM_PROMPT, DIAGNOSTIC_USER_PROMPT_TEMPLATE, CLINERA_MODEL_VERSION
from app.services.explainability.simulation.simulation_service import simulation_service
from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        # Guideline-backed FNA thresholds (ACR TI-RADS 2017)
        self.fna_thresholds = {
            3: 2.5, # TR3: FNA if >= 2.5cm
            4: 1.5, # TR4: FNA if >= 1.5cm
            5: 1.0  # TR5: FNA if >= 1.0cm
        }

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
            # Only match if they specifically say "total points", "sum of X points", etc.
            # Avoids matching sub-feature points (e.g. "3 points for shape")
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
                      features_data.get("measurements", {}).get("nodule_area_relative", 0) * 100 # Fallback
            
            threshold = self.fna_thresholds.get(target_tr)
            if threshold and size_mm < (threshold * 10):
                if re.search(r'fna\s+is\s+recommended', text, re.IGNORECASE):
                    errors.append(f"Clinical Logic Error: AI suggested FNA for a small TR{target_tr} nodule.")

        # 4. Simulation Validation (Safety Layer for What-Ifs)
        if ground_truth.get("is_simulation"):
            sim_delta = ground_truth.get("sim_delta", {})
            # Check the new total score mentioned by the AI matches simulated score
            delta_matches = re.findall(r'(?:new|simulated|resulting)\s*(?:total|score|of)\s*(\d+)', text, re.IGNORECASE)
            for m in delta_matches:
                if int(m) != target_pts:
                    errors.append(f"Simulation Mismatch: AI reported new score {m}, but deterministic simulation is {target_pts}.")

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

    async def generate_chat_stream(
        self, 
        prediction_id: str, 
        user_message: str, 
        simulation_modifications: Optional[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """
        Field-level, schema-validated streaming response.
        Protocol: [HEADER_INIT] → [FIELD_START/VALUE/DONE] per section
        """
        try:
            data = await self.get_prediction_context(prediction_id)
        except Exception as e:
            logger.error(f"Context fetch failed: {e}")
            yield f"data: [FIELD_START]:error\n\n"
            yield f"data: [FIELD_VALUE]:⚠️ Could not load scan context. Please refresh.\n\n"
            yield f"data: [FIELD_DONE]:error\n\n"
            return

        ground_truth_context = data
        features_data = data.get("features", {})
        total_points = features_data.get("total_points", 0)
        clinical_features = features_data.get("clinical_features", {})
        tirads_level = data.get("tirads", 0)

        # ── Step 1: Immediate Header Hydration (before AI call) ──────────────
        initial_metadata = {
            "confidence_score": data.get("confidence", 0.0),
            "model_version": CLINERA_MODEL_VERSION,
            "tirads_level": tirads_level,
            "total_points": total_points
        }
        yield f"data: [HEADER_INIT]{json.dumps(initial_metadata)}\n\n"
        await asyncio.sleep(0.01)

        # ── Step 2: Simulation Logic ──────────────────────────────────────────
        simulation_result = None
        if not simulation_modifications:
            if any(x in user_message.lower() for x in ["what if", "suppose", "assume", "change", "simulate"]):
                try:
                    simulation_modifications = await self._detect_simulation_intent(user_message, clinical_features)
                except Exception as e:
                    logger.error(f"Simulation intent detection failed: {e}")

        if simulation_modifications:
            try:
                simulation_result = simulation_service.run_simulation(clinical_features, simulation_modifications)
                tirads_level = simulation_result["simulated"]["tirads"]
                total_points = simulation_result["simulated"]["total_points"]
            except Exception as e:
                logger.error(f"Simulation engine failed: {e}")

        # ── Step 3: Build Prompt ──────────────────────────────────────────────
        sim_context_str = json.dumps(simulation_result["simulated"]) if simulation_result else "None"
        features_summary = ", ".join([f"{k}: {v.get('value')}" for k, v in clinical_features.items()])
        
        user_prompt = DIAGNOSTIC_USER_PROMPT_TEMPLATE.format(
            tirads_level=tirads_level,
            total_points=total_points,
            features_list=features_summary,
            size_mm=features_data.get("measurements", {}).get("nodule_max_diameter_mm", "N/A"),
            simulation_data=sim_context_str,
            user_message=user_message
        )

        # ── Step 4: LLM Generation (JSON Mode) ───────────────────────────────
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
                )
            )
            raw_json = response.text.strip()
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raw_json = ""

        # ── Step 5: Schema Validation Gate ────────────────────────────────────
        report = None
        if raw_json:
            try:
                report = json.loads(raw_json)
                required_keys = ["metadata", "rationale", "scoring_breakdown", "guideline_reference"]
                if not all(k in report for k in required_keys):
                    logger.warning(f"Schema incomplete. Keys present: {list(report.keys())}")
                    report = None
            except Exception as e:
                logger.error(f"JSON parse failed: {e}. Raw: {raw_json[:200]}")
                report = None

        if report is None:
            # Safe ACR-grounded fallback
            report = {
                "metadata": {
                    "confidence_score": data.get("confidence", 0.0),
                    "model_version": f"{CLINERA_MODEL_VERSION} (Fallback)",
                    "tirads_level": tirads_level,
                    "total_points": total_points
                },
                "rationale": (
                    f"This nodule is classified as TI-RADS {tirads_level} with a total of "
                    f"{total_points} points per ACR TI-RADS 2017. Clinical follow-up is "
                    f"determined by the nodule size and this category threshold."
                ),
                "scoring_breakdown": [],
                "simulation_impact": None,
                "guideline_reference": (
                    "ACR TI-RADS 2017: TR5 (≥7 pts) — FNA recommended if ≥1.0 cm. "
                    "Follow-up ultrasound at 1 yr if <1.0 cm."
                )
            }

        # ── MANDATORY OVERRIDE: Replace AI scoring with verified ground truth ──
        # The LLM hallucinates individual feature points even when the total is correct.
        # Scoring data MUST come from the deterministic rule engine, not the LLM.
        verified_breakdown = []
        
        # Use simulated breakdown if available (already has correct {value, points, description})
        # Otherwise use original clinical_features from Supabase
        if simulation_result:
            source_features = simulation_result["simulated"].get("breakdown", {})
        else:
            source_features = clinical_features

        for feat, details in source_features.items():
            verified_breakdown.append({
                "feature": feat,
                "value": details.get("value", "—"),
                "points": details.get("points", 0),
                "description": details.get("description", "")
            })
        
        report["scoring_breakdown"] = verified_breakdown
        # Lock metadata numerics to verified ground truth (AI cannot override these)
        report.setdefault("metadata", {})
        report["metadata"]["tirads_level"] = tirads_level
        report["metadata"]["total_points"] = total_points
        report["metadata"]["confidence_score"] = data.get("confidence", 0.0)

        # ── SIMULATION IMPACT OVERRIDE ────────────────────────────────────────
        # Inject deterministic simulation delta directly — AI cannot suppress this.
        if simulation_result:
            orig = simulation_result["original"]
            sim  = simulation_result["simulated"]
            delt = simulation_result["delta"]
            modifications = delt.get("modifications", {})
            changes = [
                f"{feat}: {details.get('value', '?')}"
                for feat, details in modifications.items()
            ]
            # Use the AI's clinical_implication if it wrote one, else generate a default
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
                "modified": {"points": sim["total_points"],  "tirads": sim["tirads"]},
                "delta": {
                    "points_change": delt["points_change"],
                    "clinical_implication": clinical_implication
                }
            }
        else:
            report["simulation_impact"] = None

        # ── Step 6: Field-Level Event Dispatcher ─────────────────────────────
        fields_to_stream = ["rationale", "scoring_breakdown", "simulation_impact", "guideline_reference"]
        for field in fields_to_stream:
            value = report.get(field)
            if value is None:
                continue

            yield f"data: [FIELD_START]:{field}\n\n"

            if isinstance(value, str):
                # Stream text in readable chunks
                for i in range(0, len(value), 60):
                    yield f"data: [FIELD_VALUE]:{value[i:i+60]}\n\n"
                    await asyncio.sleep(0.008)
            else:
                yield f"data: [FIELD_VALUE]:{json.dumps(value)}\n\n"

            yield f"data: [FIELD_DONE]:{field}\n\n"
            await asyncio.sleep(0.03)

    async def _detect_simulation_intent(self, message: str, features: Dict) -> Optional[Dict]:
        """
        Uses LLM to extract structured simulation parameters from natural language.
        Returns exact class values from FEATURE_DEFINITIONS to guarantee lookup success.
        """
        from app.models.xception_model import FEATURE_DEFINITIONS as FD

        client = clients[0] if clients else None
        if not client: return None

        # Build a map of feature → valid classes so the AI picks exactly the right string
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
