# app/services/inference/feature_classifier.py
# Xception (Real Multi-Output Model) — with Real Grad-CAM
# Xception Multi-Output Classifier with Best-Head Grad-CAM

import os
import traceback
import torch
import numpy as np
from typing import Dict
from app.models.xception_model import XceptionMultiOutput, FEATURE_DEFINITIONS
from app.services.inference.gradcam import get_xception_target_layer, compute_best_gradcam
from app.config.model_config import model_config


class FeatureClassifier:
    """
    Xception-based multi-output feature classifier.

    Architecture (from training notebook):
      backbone  : timm.create_model('xception', num_classes=0)
      shared_fc : Linear(2048→1024) → BN → ReLU → Linear(1024→512) → BN → ReLU
      heads     : composition(3), echogenicity(4), shape(2), margin(4), echogenic_foci(4)
      NO tirads head — TI-RADS comes from the rule engine downstream.

    Grad-CAM:
      Target layer : backbone.block12 (last middle-flow depthwise-sep block)
      Strategy     : Try all 5 feature heads, pick the highest-variance heatmap.
                     High variance = strong spatial discrimination = most informative.
    """

    MODEL_NAME = "xception-multioutput"
    MODEL_VERSION = model_config.feature_classifier_version

    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FeatureClassifier, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._model is None:
            self._load_model()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_model(self):
        model_path = model_config.feature_classifier_weights
        if not model_path:
            raise RuntimeError("feature_classifier_weights not found in model_config")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}")

        print(f"Loading Xception model from {model_path}...")
        self._model = XceptionMultiOutput(pretrained=False)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(model_path, map_location=device)
        state_dict = checkpoint.get("model_state_dict", checkpoint)

        missing, unexpected = self._model.load_state_dict(state_dict, strict=False)
        # Silent load check

        self._model.to(device)
        self._model.eval()
        self.device = device

        try:
            self._gradcam_layer = get_xception_target_layer(self._model)
        except AttributeError as e:
            self._gradcam_layer = None
            print(f"⚠️  Grad-CAM layer not resolved: {e}")

        print("✅ Xception model ready.")

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def classify(self, roi_tensor: torch.Tensor) -> Dict:
        """
        Run inference on a preprocessed ROI tensor (3, 299, 299).

        Step 1 — Classification under torch.no_grad() for efficiency.
        Step 2 — Grad-CAM: tries all 5 feature heads via compute_best_gradcam(),
                 picks the one with the highest spatial variance heatmap.
        """
        if roi_tensor.dim() == 3:
            roi_tensor = roi_tensor.unsqueeze(0)
        roi_tensor = roi_tensor.to(self.device)

        # ── Step 1: Classification ────────────────────────────────────
        predicted_features = {}
        feature_results = {}
        tirads_confidences = {}

        with torch.no_grad():
            outputs = self._model(roi_tensor)

            for feature_name in [
                "composition", "echogenicity", "shape",
                "margin", "echogenic_foci",
            ]:
                logits = outputs[feature_name]
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
                predicted_idx = int(np.argmax(probs))
                confidence = float(probs[predicted_idx])
                class_name = FEATURE_DEFINITIONS[feature_name]["classes"][predicted_idx]

                predicted_features[feature_name] = class_name
                feature_results[feature_name] = {
                    "index": predicted_idx,
                    "value": class_name,
                    "confidence": round(confidence, 4),
                    "all_probabilities": {
                        FEATURE_DEFINITIONS[feature_name]["classes"][i]: round(float(probs[i]), 4)
                        for i in range(len(probs))
                    },
                }

            # tirads head only exists if checkpoint has it
            if "tirads" in outputs:
                tirads_probs = torch.softmax(outputs["tirads"], dim=1).cpu().numpy()[0]
                tirads_confidences = {
                    f"TIRADS_{i+1}": float(tirads_probs[i])
                    for i in range(len(tirads_probs))
                }

        # ── Step 2: Grad-CAM ──────────────────────────────────────────
        grad_cam_data = self._compute_gradcam(roi_tensor, feature_results, predicted_features)

        return {
            "features": predicted_features,
            "feature_results": feature_results,
            "tirads_confidences": tirads_confidences,
            "grad_cam_data": grad_cam_data,
            "classifier": {
                "name": self.MODEL_NAME,
                "version": self.MODEL_VERSION,
                "device": str(self.device),
            },
        }

    # ------------------------------------------------------------------
    # Grad-CAM
    # ------------------------------------------------------------------

    def _compute_gradcam(
        self,
        roi_tensor: torch.Tensor,
        feature_results: Dict,
        predicted_features: Dict,
    ) -> Dict:
        if self._gradcam_layer is None:
            return self._gradcam_unavailable(predicted_features, "Target layer not resolved")

        try:
            heatmap_small, heatmap_large, best_head, best_class_idx = compute_best_gradcam(
                model=self._model,
                target_layer=self._gradcam_layer,
                input_tensor=roi_tensor,
                feature_results=feature_results,
            )

            is_flat = float(np.max(heatmap_small)) < 1e-8
            if is_flat:
                return self._gradcam_unavailable(
                    predicted_features,
                    "All heads produced flat heatmaps — model may not be spatially discriminative for this image"
                )

            return {
                "gradcam_available": True,
                "target_layer": "backbone.block12",
                "target_class": f"{best_head}_{best_class_idx}",
                "heatmap_shape": list(heatmap_small.shape),
                # heatmap: raw 10x10 — stored in DB (~1KB)
                "heatmap": heatmap_small.tolist(),
                # heatmap_upsampled: 299x299 — NOT stored in DB.
                # Kept in-memory only for PDF report generator.
                # Frontend reconstructs via bilinear upsampling at render time.
                "_heatmap_upsampled_memory_only": heatmap_large.tolist(),
                "top_features": [best_head] + [
                    f for f in predicted_features.keys() if f != best_head
                ][:1],
                "color_mapping": {
                    "colormap": "jet",
                    "min_value": 0.0,
                    "max_value": 1.0,
                    "description": "Blue (0.0) = low activation, Red (1.0) = high activation",
                },
            }

        except Exception as e:
            # Grad-CAM is optional, so we don't want to crash the whole pipeline
            return self._gradcam_unavailable(predicted_features, str(e))

    @staticmethod
    def _gradcam_unavailable(predicted_features: Dict, reason: str = "") -> Dict:
        print(f"⚠️  Grad-CAM unavailable: {reason}")
        return {
            "gradcam_available": False,
            "target_layer": "backbone.block12",
            "target_class": None,
            "heatmap_shape": [10, 10],
            "heatmap": np.zeros((10, 10)).tolist(),
            # No heatmap_upsampled stored — frontend upsamples the 10x10 heatmap at render time.
            "top_features": list(predicted_features.keys())[:2],
            "color_mapping": {
                "colormap": "jet",
                "min_value": 0.0,
                "max_value": 1.0,
                "description": "Blue (0.0) = low activation, Red (1.0) = high activation",
            },
            "error": reason,
        }