#app/services/inference/inference_pipeline.py

import time
from typing import Dict, Any, Optional
from PIL import Image
from io import BytesIO
import numpy as np

from app.services.inference.roi_detector import FasterRCNNDetector
from app.services.inference.feature_classifier import FeatureClassifier
from app.services.ruleEngine.tirads import calculate_tirads
from app.utils.box_utils import xyxy_to_xywh
from app.services.preprocessing.feature_preprocessing import xception_preprocess_from_array
from app.config.model_config import model_config


class InferencePipeline:
    """
    Pure ML Inference Pipeline.
    Strictly handles vision processing and clinical rule execution.
    Zero coupling with databases, storage, or external APIs.
    """

    PIPELINE_VERSION = model_config.pipeline_version

    def __init__(self):
        self.roi_detector = FasterRCNNDetector()
        self.feature_classifier = FeatureClassifier()

    def run(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Synchronous entry point for the pure ML pipeline.
        
        Responsibilities:
        - Image decoding
        - ROI Detection (FasterRCNN)
        - Preprocessing
        - Feature Classification (Xception)
        - TI-RADS Rule Engine execution
        - Confidence alignment
        - Assembling structured ML output
        """
        start_time = time.time()

        # ── 1. Load raw image ─────────────────────────────────────────
        try:
            img = Image.open(BytesIO(image_bytes)).convert("RGB")
            image_width, image_height = img.size
        except Exception as e:
            raise RuntimeError(f"ML Pipeline: Failed to decode image: {str(e)}")

        # ── 2. ROI Detection ──────────────────────────────────────────
        image_array = np.array(img)
        roi_result = self.roi_detector.detect(image_array)
        roi_voc = roi_result["bounding_box"]

        # Convert VOC to XYWH for structured output
        final_bounding_box = xyxy_to_xywh(
            {
                **roi_voc,
                "image_width": image_width,
                "image_height": image_height,
                "coordinate_space": "raw_image",
            }
        )

        # ── 3. Preprocessing ──────────────────────────────────────────
        bbox_list = [
            roi_voc["xmin"],
            roi_voc["ymin"],
            roi_voc["xmax"],
            roi_voc["ymax"],
        ]
        roi_tensor = xception_preprocess_from_array(image_array, bbox_list)

        # ── 4. Classification + Grad-CAM ──────────────────────────────
        class_result = self.feature_classifier.classify(roi_tensor)
        feature_metadata = class_result["feature_results"]

        # ── 5. TI-RADS Rule Engine (Clinical Source of Truth) ─────────
        tirads_result = calculate_tirads(feature_metadata)
        final_tirads = tirads_result["tirads"]
        final_confidence = tirads_result["confidence"]

        # ── 6. Probability Alignment ──────────────────────────────────
        tirads_confidences = self._align_confidences_with_rule_engine(
            final_tirads, 
            final_confidence
        )

        # ── 7. Grad-CAM data ──────────────────────────────────────────
        # Preserve raw Grad-CAM data including upsampled heatmaps.
        grad_cam_data = class_result.get("grad_cam_data", {})

        inference_time_ms = int((time.time() - start_time) * 1000)

        # ── 8. Assemble structured ML response ────────────────────────
        return {
            "tirads": final_tirads,
            "predicted_class": final_tirads,
            "confidence": final_confidence,
            "tirads_confidences": tirads_confidences,
            "features": {
                "clinical_features": tirads_result["breakdown"],
                "total_points": tirads_result["total_points"],
                "measurements": {
                    "nodule_area_relative": round(
                        (roi_voc["xmax"] - roi_voc["xmin"])
                        * (roi_voc["ymax"] - roi_voc["ymin"])
                        / (image_width * image_height),
                        4,
                    )
                },
            },
            "bounding_box": final_bounding_box,
            "roi_score": roi_result.get("score", 0.0),
            "grad_cam_data": grad_cam_data,
            "models": {
                "roi_detector": roi_result["detector"],
                "feature_classifier": class_result["classifier"],
                "rule_engine": tirads_result["rule_engine"],
            },
            "pipeline_version": self.PIPELINE_VERSION,
            "inference_time_ms": inference_time_ms
        }

    def _align_confidences_with_rule_engine(
        self, 
        final_tirads: int, 
        final_confidence: float
    ) -> Dict[str, float]:
        """
        Aligns the confidence scores with the Rule Engine's result for UI consistency.
        Forces the 'winner' in the UI to match the clinical TI-RADS category.
        """
        predicted_tirads_key = f"TIRADS_{final_tirads}"
        winner_prob = final_confidence
        
        remaining_prob = 1.0 - winner_prob
        other_keys = [f"TIRADS_{i}" for i in range(1, 6) if i != final_tirads]
        
        tirads_confidences = {predicted_tirads_key: round(winner_prob, 4)}
        for k in other_keys:
            tirads_confidences[k] = round(remaining_prob / len(other_keys), 4)
            
        return tirads_confidences