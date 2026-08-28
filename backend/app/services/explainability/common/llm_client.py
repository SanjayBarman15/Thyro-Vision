#backend/app/services/explainability/common/llm_client.py

import os
import logging
from google import genai
from google.genai import types
from app.services.explainability.common.prompt_templates import EXPLAINER_SYSTEM_PROMPT, EXPLAINER_USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

# Configure API Keys
api_keys = [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("NVIDIA_API_KEY")
]
# Remove None values
api_keys = [k for k in api_keys if k]

# Initialize Clients
clients = []
for key in api_keys:
    try:
        clients.append(genai.Client(api_key=key))
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client with key {key[:8]}...: {e}")

if not clients:
    logger.warning("No Gemini API keys configured. LLM features will be disabled.")

MODEL_ID = "gemini-2.5-flash-lite"

def generate_fallback_explanation(structured_data: dict) -> str:
    """
    Rule-based clinical summary used when LLM is unavailable.
    """
    tirads = structured_data.get("tirads", "N/A")
    features = structured_data.get("features", {})
    
    def get_val(f_key):
        val = features.get(f_key)
        if isinstance(val, dict):
            return val.get("value", "")
        return str(val) if val else ""

    summary = f"Clinical Summary (Rule-Based): The thyroid nodule is classified as TI-RADS {tirads}. "
    findings = []
    comp = get_val("composition")
    echo = get_val("echogenicity")
    marg = get_val("margins") or get_val("margin")
    
    if comp: findings.append(f"composition is {comp.lower()}")
    if echo: findings.append(f"echogenicity is {echo.lower()}")
    if marg: findings.append(f"margins are {marg.lower()}")
    
    if findings:
        summary += "Key findings include: " + ", ".join(findings) + "."
    else:
        summary += "Analysis based on standard AC-TIRADS feature extraction."
        
    return summary

async def generate_explanation(structured_data: dict, use_llm: bool = True) -> str:
    """
    Generate explanation using Gemini based on structured vision data.
    Supports fallback across multiple API keys if one fails with a 429 error.
    """
    if not use_llm or not clients:
        return generate_fallback_explanation(structured_data)

    tirads = structured_data.get("tirads", "Unknown")
    user_prompt = EXPLAINER_USER_PROMPT_TEMPLATE.format(
        tirads=tirads,
        structured_data=structured_data
    )

    # Try each client in sequence
    for i, client in enumerate(clients):
        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=[EXPLAINER_SYSTEM_PROMPT, user_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=256,
                )
            )
            
            if response.text:
                return response.text.strip()
                
        except Exception as e:
            error_msg = str(e)
            # If it's a rate limit error and we have more clients, try the next one
            if "429" in error_msg and i < len(clients) - 1:
                logger.warning(f"Gemini Key {i+1} rate limited. Falling back to Key {i+2}...")
                continue
            
            # For other errors or if it was the last client
            logger.error(f"Gemini API error (Key {i+1}): {error_msg}")
            break

    return generate_fallback_explanation(structured_data)
