# app/services/benchmark_service.py
"""
Benchmark Service — runs fixed test images through both models independently.

FasterRCNN:  measures IoU between predicted bbox and ground truth bbox
Xception:    measures TI-RADS + per-feature accuracy (using GT bbox as input
             so Xception is isolated from FasterRCNN errors)

Results stored in:
  benchmark_runs    ← aggregate per pipeline version
  benchmark_results ← per-image detail
"""
import os
import time
import cv2
import numpy as np
import asyncio
import httpx
from typing import Generator
from datetime import datetime, timezone

from app.db.supabase import supabase_admin
from app.services.preprocessing.bbox_preprocessing import detection_preprocess_from_array
from app.services.preprocessing.feature_preprocessing import xception_preprocess_from_array
from app.services.ruleEngine.tirads import calculate_tirads

# ── IoU calculation ───────────────────────────────────────
def calculate_iou(box1: list, box2: list) -> float:
    """IoU between two [x1, y1, x2, y2] bboxes. Returns 0.0–1.0."""
    if not box1 or not box2:
        return 0.0
        
    ix1 = max(box1[0], box2[0]);  iy1 = max(box1[1], box2[1])
    ix2 = min(box1[2], box2[2]);  iy2 = min(box1[3], box2[3])
    
    intersection = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if intersection <= 0:
        return 0.0

    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    
    return round(intersection / union, 4) if union > 0 else 0.0


# ── Feature comparison ────────────────────────────────────
def _normalize_feature_string(val: str) -> str:
    if not val:
        return ""
    # Lowercase and strip whitespace
    s = str(val).lower().strip()
    # Normalize snake_case to spaces (e.g. taller_than_wide -> taller than wide)
    s = s.replace("_", " ")
    # Standardize specific phrasings (e.g. "mixed cystic and solid" vs "mixed cystic solid")
    s = s.replace(" and ", " ") 
    return s.strip()

def compare_features(predicted: dict, ground_truth: dict) -> dict:
    """Returns {feature_name: bool} for each ACR feature."""
    result = {}
    for key in ["composition", "echogenicity", "shape", "margin", "echogenic_foci"]:
        pv = predicted.get(key, {})
        gv = ground_truth.get(key, {})
        if isinstance(pv, dict): pv = pv.get("value", "")
        if isinstance(gv, dict): gv = gv.get("value", "")
        
        norm_pv = _normalize_feature_string(pv)
        norm_gv = _normalize_feature_string(gv)
        
        result[key] = (norm_pv == norm_gv) if norm_gv else False
    return result


# ── Download image ────────────────────────────────────────
def download_image_sync(url: str) -> bytes:
    """
    Downloads image from Supabase storage using the service role key.
    Works for both public and private buckets.
    """
    # Extract path from URL: .../object/public/bucket_name/path/to/file.jpg
    # Or .../object/authenticated/bucket_name/path/to/file.jpg
    bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "thyrovision-images")
    
    if bucket_name in url:
        # Extract everything after bucket_name/
        path = url.split(f"{bucket_name}/")[-1]
        try:
            return supabase_admin.storage.from_(bucket_name).download(path)
        except Exception as e:
            print(f"⚠️  Supabase download failed for {path}: {e}")
            # Fallback to public HTTP if Supabase client fails
            pass

    # Fallback to standard HTTP GET (for external images or if parsing fails)
    with httpx.Client(timeout=30) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content


# ── Get previous run for regression tracking ─────────────
def get_previous_run_results(current_run_id: str) -> dict:
    """Returns {benchmark_image_id: result_row} from the previous run."""
    try:
        latest = supabase_admin.table("benchmark_runs") \
            .select("id") \
            .neq("id", current_run_id) \
            .order("recorded_at", desc=True) \
            .limit(1) \
            .execute()

        if not latest.data:
            return {}

        prev_id = latest.data[0]["id"]
        rows = supabase_admin.table("benchmark_results") \
            .select("benchmark_image_id, predicted_tirads, iou_score, bbox_correct") \
            .eq("benchmark_run_id", prev_id) \
            .execute()

        return {str(r["benchmark_image_id"]): r for r in (rows.data or [])}
    except Exception as e:
        print(f"⚠️  Could not fetch previous run: {e}")
        return {}


# ── Main benchmark generator ──────────────────────────────
def run_benchmark_images(
    admin_id: str,
    roi_detector,
    feature_classifier,
) -> Generator[tuple[int, int, dict], None, None]:
    """
    Generator — yields (current_index, total, result_row) after each image.
    Celery task iterates this and updates Redis progress key.
    """
    

    # ── Fetch active benchmark images ────────────────────
    images_res = supabase_admin.table("benchmark_images") \
        .select("*") \
        .eq("is_active", True) \
        .order("ground_truth_tirads", desc=False) \
        .execute()

    images = images_res.data or []
    total  = len(images)

    if total == 0:
        print("⚠️  No active benchmark images found — seed benchmark_images table first")
        return

    # ── Create benchmark_run row ──────────────────────────
    run_res = supabase_admin.table("benchmark_runs").insert({
        "pipeline_version": os.getenv("PIPELINE_VERSION", "unknown"),
        "model_metadata": {
            "roi_detector":       os.getenv("ROI_DETECTOR_VERSION"),
            "feature_classifier": os.getenv("FEATURE_CLASSIFIER_VERSION"),
            "rule_engine":        os.getenv("RULE_ENGINE_VERSION"),
        },
        "triggered_by": admin_id,
        "recorded_at":  datetime.now(timezone.utc).isoformat(),
        "dataset_size": total,
    }).execute()

    run_id = run_res.data[0]["id"]
    print(f"📋 Created benchmark_run: {run_id}")

    # ── Previous run for regression tracking ─────────────
    prev_results = get_previous_run_results(run_id)

    results      = []
    IOU_THRESHOLD = 0.5  # Pascal VOC standard

    for idx, image in enumerate(images, start=1):
        try:
            image_bytes = download_image_sync(image["file_url"])

            gt_bbox     = image.get("ground_truth_bbox")
            gt_tirads   = image["ground_truth_tirads"]
            gt_features = image.get("ground_truth_features", {})

            # ══ FasterRCNN benchmark ══════════════════════
            roi_start = time.time()
            pred_bbox = None
            roi_conf  = 0.0
            try:
                # Decode bytes to RGB numpy array for detector
                image_array = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
                image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)

                roi_input  = detection_preprocess_from_array(image_array)
                roi_output = roi_detector.detect(image_array) # detect() takes the array directly
                pred_bbox  = roi_output.get("bounding_box")
                # Confidence is named 'score' in FasterRCNNDetector
                roi_conf   = roi_output.get("score", 0.0) 
            except Exception as e:
                print(f"⚠️  ROI detector failed on image {idx}: {e}")
            roi_time_ms = int((time.time() - roi_start) * 1000)

            # ── BBox Normalization ───────────────────────
            gt_voc = None
            if gt_bbox and isinstance(gt_bbox, dict):
                gx, gy, gw, gh = gt_bbox.get("x", 0), gt_bbox.get("y", 0), gt_bbox.get("width", 0), gt_bbox.get("height", 0)
                gt_voc = [gx, gy, gx + gw, gy + gh]

            pred_voc = None
            if pred_bbox and isinstance(pred_bbox, dict):
                pred_voc = [pred_bbox.get("xmin", 0), pred_bbox.get("ymin", 0), pred_bbox.get("xmax", 0), pred_bbox.get("ymax", 0)]

            iou_score    = calculate_iou(pred_voc, gt_voc) if pred_voc and gt_voc else None
            bbox_correct = (iou_score >= IOU_THRESHOLD)      if iou_score is not None else None

            # ══ Xception benchmark ════════════════════════
            # Use GROUND TRUTH bbox — isolates Xception from FasterRCNN
            xception_start   = time.time()
            pred_tirads      = None
            pred_features    = {}
            feature_acc      = {}
            xception_time_ms = 0

            try:
                if gt_voc:
                    xception_input  = xception_preprocess_from_array(image_array, gt_voc)
                    xception_output = feature_classifier.classify(xception_input)
                    pred_features   = xception_output.get("feature_results", {})
                    pred_full        = calculate_tirads(pred_features)
                    pred_tirads      = pred_full["tirads"]
                    feature_acc      = compare_features(pred_features, gt_features)
                    if "grad_cam_data" in xception_output:
                        pred_features["grad_cam_data"] = xception_output["grad_cam_data"]
                    xception_time_ms = int((time.time() - xception_start) * 1000)
            except Exception as e:
                print(f"⚠️  Xception failed on image {idx}: {e}")

            tirads_correct = (pred_tirads == gt_tirads) if pred_tirads is not None else None

            # ── Regression tracking ───────────────────────
            prev = prev_results.get(str(image["id"]))
            prev_tirads       = prev["predicted_tirads"] if prev else None
            prev_iou          = prev["iou_score"]        if prev else None
            prev_bbox_correct = prev["bbox_correct"]     if prev else None

            tirads_regression  = (prev_tirads == gt_tirads and pred_tirads != gt_tirads) \
                                  if prev_tirads is not None and pred_tirads is not None else None
            tirads_improvement = (prev_tirads != gt_tirads and pred_tirads == gt_tirads) \
                                  if prev_tirads is not None and pred_tirads is not None else None
            bbox_regression    = (prev_bbox_correct is True  and bbox_correct is False) \
                                  if prev_bbox_correct is not None and bbox_correct is not None else None
            bbox_improvement   = (prev_bbox_correct is False and bbox_correct is True) \
                                  if prev_bbox_correct is not None and bbox_correct is not None else None

            # ── Save to benchmark_results ─────────────────
            row = {
                "benchmark_run_id":          run_id,
                "benchmark_image_id":        str(image["id"]),
                "image_description":         image.get("description", ""),
                "image_index":               idx,

                "predicted_bbox": {
                    "x": pred_bbox["xmin"],
                    "y": pred_bbox["ymin"],
                    "width": pred_bbox["xmax"] - pred_bbox["xmin"],
                    "height": pred_bbox["ymax"] - pred_bbox["ymin"]
                } if pred_bbox else None,
                "ground_truth_bbox":         gt_bbox,
                "iou_score":                 iou_score,
                "bbox_correct":              bbox_correct,
                "roi_confidence":            roi_conf,
                "roi_inference_time_ms":     roi_time_ms,

                "predicted_tirads":          pred_tirads,
                "ground_truth_tirads":       gt_tirads,
                "predicted_features":        pred_features,
                "ground_truth_features":     gt_features,
                "feature_accuracy":          feature_acc,
                "xception_inference_time_ms": xception_time_ms,

                "prev_predicted_tirads":     prev_tirads,
                "prev_iou_score":            prev_iou,
                "tirads_is_regression":      tirads_regression,
                "tirads_is_improvement":     tirads_improvement,
                "bbox_is_regression":        bbox_regression,
                "bbox_is_improvement":       bbox_improvement,
            }

            supabase_admin.table("benchmark_results").insert(row).execute()
            results.append(row)

        except Exception as e:
            print(f"❌ Image {idx} failed: {e}")
            results.append({"error": str(e), "benchmark_image_id": str(image["id"])})

        yield idx, total, results[-1]

    # ── Update benchmark_run with aggregates ─────────────
    _update_run_aggregates(run_id, results, IOU_THRESHOLD)


def _update_run_aggregates(run_id: str, results: list, iou_threshold: float):
    """Computes and saves aggregate metrics to benchmark_runs row."""
    valid = [r for r in results if r and "error" not in r]
    total = len(valid)
    print(f"📊 Calculating aggregates for run {run_id} — Total valid results: {total}")
    if total == 0:
        print("⚠️ No valid results to aggregate.")
        return

    # FasterRCNN
    bbox_results       = [r for r in valid if r.get("iou_score") is not None]
    avg_iou            = round(sum(r["iou_score"] for r in bbox_results) / len(bbox_results), 3) \
                         if bbox_results else None
    bbox_correct_count = sum(1 for r in bbox_results if r.get("bbox_correct"))
    bbox_accuracy      = round(bbox_correct_count / len(bbox_results), 3) \
                         if bbox_results else None

    # Xception
    tirads_results  = [r for r in valid if r.get("predicted_tirads") is not None]
    tirads_correct  = sum(1 for r in tirads_results if r.get("tirads_correct",
                          r.get("predicted_tirads") == r.get("ground_truth_tirads")))
    tirads_accuracy = round(tirads_correct / len(tirads_results), 3) \
                      if tirads_results else None

    feature_keys = ["composition", "echogenicity", "shape", "margin", "echogenic_foci"]
    feature_accuracy = {
        k: round(sum(1 for r in tirads_results
                     if r.get("feature_accuracy", {}).get(k)) / len(tirads_results), 3)
        for k in feature_keys
    } if tirads_results else {}

    confusion = [[0] * 5 for _ in range(5)]
    for r in tirads_results:
        gt   = (r.get("ground_truth_tirads") or 1) - 1
        pred = (r.get("predicted_tirads") or 1) - 1
        if 0 <= gt < 5 and 0 <= pred < 5:
            confusion[gt][pred] += 1

    avg_roi_ms      = round(sum(r.get("roi_inference_time_ms", 0)      for r in valid) / total)
    avg_xception_ms = round(sum(r.get("xception_inference_time_ms", 0) for r in valid) / total)

    print(f"📈 Sums — BBox Correct: {bbox_correct_count}/{len(bbox_results)}, TIRADS Correct: {tirads_correct}/{len(tirads_results)}")

    try:
        supabase_admin.table("benchmark_runs").update({
            "bbox_accuracy":      bbox_accuracy,
            "avg_iou":            avg_iou,
            "bbox_correct_count": bbox_correct_count,
            "iou_threshold":      iou_threshold,
            "avg_roi_ms":         avg_roi_ms,
            "bbox_regressions":   sum(1 for r in valid if r.get("bbox_is_regression")),
            "bbox_improvements":  sum(1 for r in valid if r.get("bbox_is_improvement")),

            "tirads_accuracy":      tirads_accuracy,
            "tirads_correct_count": tirads_correct,
            "feature_accuracy":     feature_accuracy,
            "confusion_matrix":     confusion,
            "avg_xception_ms":      avg_xception_ms,
            "tirads_regressions":   sum(1 for r in valid if r.get("tirads_is_regression")),
            "tirads_improvements":  sum(1 for r in valid if r.get("tirads_is_improvement")),

            "dataset_size": total,
        }).eq("id", run_id).execute()
        print(f"💾 Aggregates updated in DB for run {run_id}")
    except Exception as e:
        print(f"❌ Failed to update benchmark_runs aggregates: {e}")

    print(f"✅ Aggregates saved — ROI: IoU={avg_iou} Acc={bbox_accuracy} | "
          f"Xception: TI-RADS={tirads_accuracy}")