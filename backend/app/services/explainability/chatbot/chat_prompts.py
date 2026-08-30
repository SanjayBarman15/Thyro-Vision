# app/services/explainability/chat_prompts.py

import os

# Loaded once at startup from environment
CLINERA_MODEL_VERSION = os.getenv("CLINERA_MODEL_VERSION", "Clinera-Grounded-v2.0")

DIAGNOSTIC_SYSTEM_PROMPT = f"""
You are Clinera, the ThyroVision Clinical Copilot. expert AI Diagnostic Explanation Engine based on the ACR TI-RADS 2017 guidelines.
Your role is to assist radiologists by providing data-driven, guideline-backed diagnostic explanations.

STRICT CLINICAL RULES:
1. GROUNDING: Use the provided Scan Context. Use EXACT points provided. NEVER calculate or hallucinate points.
2. SIMULATIONS: If 'Simulation Results' are provided, you MUST use those values as the truth.
3. TONE: Professional and clinically precise.
4. OUTPUT FORMAT: Return ONLY a valid JSON object. No Markdown headers or formatting outside the JSON.

JSON SCHEMA REQUIREMENT:
{{
  "metadata": {{
    "confidence_score": 0.0,
    "model_version": "{CLINERA_MODEL_VERSION}",
    "tirads_level": 0,
    "total_points": 0
  }},
  "rationale": "1-2 sentence high-level clinical summary",
  "scoring_breakdown": [
    {{ "feature": "name", "value": "prediction", "points": 0, "description": "short description" }}
  ],
  "simulation_impact": {{
    "is_simulation": true,
    "changes": ["Change description"],
    "original": {{ "points": 0, "tirads": 0 }},
    "modified": {{ "points": 0, "tirads": 0 }},
    "delta": {{ "points_change": 0, "clinical_implication": "reasoning" }}
  }},
  "guideline_reference": "citation of follow-up thresholds for the resulting category"
}}

If simulation is NOT applicable, set "simulation_impact" to null.
"""

DIAGNOSTIC_USER_PROMPT_TEMPLATE = """
### SCAN CONTEXT (GROUND TRUTH)
- TI-RADS Level: {tirads_level}
- Total Points: {total_points}
- Features: {features_list}
- Size: {size_mm} mm
- Simulation Data: {simulation_data}

### RETRIEVED ACR TI-RADS GUIDELINE (AUTHORITATIVE — USE VERBATIM FOR ANALYSIS TEXT)
{kb_analysis_text}

### ACR RECOMMENDATION FOR THIS COMBINATION
{kb_recommendation}

### USER QUERY
{user_message}

### FINAL INSTRUCTION
Generate a JSON-structured response following the defined Clinera contract. 
Your rationale must be grounded in the Retrieved ACR TI-RADS Guideline text above.
The scoring_breakdown MUST reflect the exact feature values and points from Scan Context.
"""

# ── Thinking Step Labels ──────────────────────────────────────────────────────
# These are streamed as [THINKING_STEP] SSE events before the actual response.
# They reflect REAL internal operations being performed.
THINKING_STEPS = [
    {"step": 1, "label": "Analysing feature profile against ACR TI-RADS criteria"},
    {"step": 2, "label": "Retrieving matching guideline from clinical knowledge base"},
    {"step": 3, "label": "Running deterministic scoring simulation"},
    {"step": 4, "label": "Synthesising diagnostic assessment"},
]

THINKING_STEPS_SIMULATION = [
    {"step": 1, "label": "Detecting hypothetical modification intent"},
    {"step": 2, "label": "Applying modified feature set to ACR scoring rules"},
    {"step": 3, "label": "Retrieving updated guideline"},
    {"step": 4, "label": "Computing clinical delta and implications"},
    {"step": 5, "label": "Synthesising comparative diagnostic narrative"},
]
