# app/services/explainability/rag/feature_scorer.py
"""
Standalone ACR TI-RADS feature scorer.
Works independently — no Supabase, no scan ID needed.
Used for hypothetical / standalone simulation queries.
"""

from typing import Dict, Any, Tuple
from app.services.explainability.rag.kb_loader import kb_loader


def score_standalone(features_input: Dict[str, str]) -> Dict[str, Any]:
    """
    Score a hypothetical set of 5 TI-RADS features without a real scan.
    
    Args:
        features_input: {
            "composition": "mixed_cystic_solid",
            "echogenicity": "hypoechoic",
            "shape": "wider_than_tall",
            "margin": "smooth",
            "echogenic_foci": "none"
        }
    
    Returns:
        Full context dict compatible with chat_service expectations.
    """
    if not kb_loader._loaded:
        kb_loader.load()

    tirads, total_points, breakdown = kb_loader.score_features(features_input)
    analysis_text, recommendation, _, _ = kb_loader.retrieve_kb_text(features_input)

    # Format as clinical_features compatible structure
    clinical_features = {}
    for feat, data in breakdown.items():
        clinical_features[feat] = {
            "value": data["value"],
            "points": data["points"],
            "description": data.get("description", ""),
            "confidence": 1.0,  # Hypothetical = certainty
        }

    return {
        "tirads": tirads,
        "total_points": total_points,
        "clinical_features": clinical_features,
        "kb_analysis_text": analysis_text,
        "kb_recommendation": recommendation,
        "is_standalone": True,
        "confidence": 1.0,
    }
