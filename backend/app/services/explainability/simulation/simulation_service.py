# app/services/explainability/simulation_service.py
from typing import Dict, Any
from app.services.ruleEngine.tirads import calculate_tirads
from app.models.xception_model import FEATURE_DEFINITIONS

class SimulationService:
    """
    Service for performing deterministic 'What-If' clinical simulations.
    Isolates hypothetical recalculations from the original scan data.
    """
    
    @staticmethod
    def run_simulation(original_features: Dict[str, Any], modifications: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applies modifications to original features and recalculates TI-RADS.
        """
        # Create a deep copy of features
        import copy
        simulated_features = copy.deepcopy(original_features)
        
        for feature_name, mod_data in modifications.items():
            if feature_name in FEATURE_DEFINITIONS:
                # Resolve the value string to an index
                requested_val = mod_data.get("value", "").lower().replace(" ", "_")
                
                # Find matching index in definitions
                match_idx = None
                for i, val in enumerate(FEATURE_DEFINITIONS[feature_name]["classes"]):
                    if val.lower() == requested_val or val.lower().replace("_", " ") == requested_val.replace("_", " "):
                        match_idx = i
                        break
                
                if match_idx is not None:
                    # Update feature with correct index and value for the rule engine
                    simulated_features[feature_name] = {
                        "index": match_idx,
                        "value": FEATURE_DEFINITIONS[feature_name]["classes"][match_idx],
                        "confidence": 1.0, # Hypothetical is 100% certain
                        "is_simulated": True
                    }
        
        # Calculate new score using the Ground Truth Rule Engine
        original_result = calculate_tirads(original_features)
        simulated_result = calculate_tirads(simulated_features)
        
        return {
            "original": {
                "tirads": original_result["tirads"],
                "total_points": original_result["total_points"]
            },
            "simulated": {
                "tirads": simulated_result["tirads"],
                "total_points": simulated_result["total_points"],
                "breakdown": simulated_result["breakdown"]
            },
            "delta": {
                "tirads_change": simulated_result["tirads"] - original_result["tirads"],
                "points_change": simulated_result["total_points"] - original_result["total_points"],
                "modifications": modifications
            },
            "guidelines_version": "ACR 2017"
        }

simulation_service = SimulationService()
