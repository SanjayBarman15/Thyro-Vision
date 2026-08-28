#app/services/rules/tirads.py
# TI-RADS Rule Engine (ACR Point System)
from typing import Dict
from app.models.xception_model import FEATURE_DEFINITIONS
from app.config.model_config import model_config

def calculate_tirads(feature_results: dict) -> Dict:
    """
    Calculates the TI-RADS category using the official ACR point system.
    
    Args:
        feature_results: Dict containing predicted feature metadata (indices)
    """
    total_points = 0
    breakdown = {}
    
    # Names in feature_results match FEATURE_DEFINITIONS keys
    # ACR features: composition, echogenicity, shape, margin, echogenic_foci
    
    for feature_name in ['composition', 'echogenicity', 'shape', 'margin', 'echogenic_foci']:
        data = feature_results.get(feature_name)
        if not data:
            continue
        
        # Handle two data formats:
        # 1. Live inference / simulated: has 'index' → use FEATURE_DEFINITIONS lookup
        # 2. Supabase stored (original): has 'value' + 'points' → use stored values directly
        if 'index' in data:
            idx = data['index']
            points = FEATURE_DEFINITIONS[feature_name]['points'][idx]
            description = FEATURE_DEFINITIONS[feature_name]['descriptions'][idx]
            value = data['value']
        elif 'points' in data:
            # Trust the stored points (already calculated by rule engine at inference time)
            points = data['points']
            value = data.get('value', '—')
            description = data.get('description', '')
        else:
            continue
            
        total_points += points
        breakdown[feature_name] = {
            "value": value,
            "points": points,
            "description": description
        }

    # ACR TI-RADS Mapping:
    # 0 pts = TR1
    # 2 pts = TR2
    # 3 pts = TR3
    # 4-6 pts = TR4
    # 7+ pts = TR5
    if total_points == 0:
        tirads = 1
    elif total_points == 2:
        tirads = 2
    elif total_points == 3:
        tirads = 3
    elif 4 <= total_points <= 6:
        tirads = 4
    else:  # 7+
        tirads = 5

    # Confidence calculation: Use the average confidence of all 5 features
    confidence = sum(f['confidence'] for f in feature_results.values() if isinstance(f, dict) and 'confidence' in f) / 5.0

    return {
        "tirads": tirads,
        "total_points": total_points,
        "confidence": round(confidence, 4),
        "breakdown": breakdown,
        "rule_engine": {
            "name": "acr-tirads-official",
            "version": model_config.rule_engine_version,
            "point_system": "ACR 2017"
        }
    }
