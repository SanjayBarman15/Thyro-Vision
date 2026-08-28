#backend/app/services/explainability/comparison/comparison_service.py

import logging
from google.genai import types
from app.services.explainability.common.llm_client import clients, MODEL_ID
from app.services.explainability.comparison.comparison_prompts import COMPARISON_SYSTEM_PROMPT, COMPARISON_USER_PROMPT_TEMPLATE
from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)

async def get_scan_data(prediction_id: str):
    """Fetch prediction and its associated raw image data."""
    res = supabase_admin.table("predictions").select(
        "*, raw_images!inner(id, uploaded_at)"
    ).eq("id", prediction_id).single().execute()
    
    if not res.data:
        return None
    
    return res.data

async def compare_scans(id_a: str, id_b: str) -> str:
    """
    Compares two scans and returns an AI-generated delta analysis.
    """
    if not clients:
        return "AI Comparison unavailable: No Gemini API keys configured."

    # 1. Fetch data for both scans
    scan_a = await get_scan_data(id_a)
    scan_b = await get_scan_data(id_b)

    if not scan_a or not scan_b:
        return "Error: Could not retrieve data for one or both scans."

    # 2. Prepare prompt data
    def format_features(features):
        if not features: return "No specific features extracted."
        return ", ".join([f"{k}: {v.get('value') if isinstance(v, dict) else v}" for k, v in features.items()])

    def get_risk_level(tirads):
        mapping = {1: "Benign", 2: "Not Suspicious", 3: "Mildly Suspicious", 4: "Moderately Suspicious", 5: "Highly Suspicious"}
        return mapping.get(tirads, "Unknown")

    prompt_data = {
        "date_a": scan_a["raw_images"]["uploaded_at"],
        "tirads_a": scan_a["tirads"],
        "risk_a": get_risk_level(scan_a["tirads"]),
        "features_a": format_features(scan_a["features"]),
        "bbox_a": scan_a.get("bounding_box", "N/A"),
        
        "date_b": scan_b["raw_images"]["uploaded_at"],
        "tirads_b": scan_b["tirads"],
        "risk_b": get_risk_level(scan_b["tirads"]),
        "features_b": format_features(scan_b["features"]),
        "bbox_b": scan_b.get("bounding_box", "N/A"),
    }

    user_prompt = COMPARISON_USER_PROMPT_TEMPLATE.format(**prompt_data)

    # 3. Call Gemini (with fallback across keys, prioritizing key 2)
    # Reversing clients to use the 2nd key first as per requirement
    prioritized_clients = list(reversed(clients))
    
    for i, client in enumerate(prioritized_clients):
        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=[COMPARISON_SYSTEM_PROMPT, user_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=500,
                )
            )
            
            if response.text:
                return response.text.strip()
                
        except Exception as e:
            error_msg = str(e)
            current_key_num = 2 if (i == 0 and len(clients) > 1) else 1
            
            if "429" in error_msg and i < len(prioritized_clients) - 1:
                logger.warning(f"Comparison: API Key {current_key_num} rate limited. Trying next...")
                continue
            logger.error(f"Comparison API error (Key {current_key_num}): {error_msg}")
            break

    return "AI was unable to generate a comparison at this time. Please try again later."
