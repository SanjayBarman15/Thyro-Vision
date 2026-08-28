# backend/app/api/benchmark.py
import os
import json
import redis
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.db.auth import require_admin
from app.db.supabase import supabase_admin, STORAGE_BUCKET
from app.tasks.benchmark import run_benchmark
from app.utils.logger import log_event

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])

r = redis.from_url(
    os.getenv("REDIS_CACHE_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0")),
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
)

LOCK_KEY     = "benchmark:lock"
LAST_RUN_KEY = "benchmark:last_run"
COOLDOWN_TTL = 6 * 60 * 60


# ── POST /benchmark/trigger ───────────────────────────────
@router.post("/trigger")
async def trigger_benchmark(admin=Depends(require_admin)):
    admin_id   = str(admin["sub"])
    admin_name = admin.get("name") or admin.get("email", "Admin")
    print(f"📥 Benchmark trigger received from {admin_name}")

    try:
        lock_raw = r.get(LOCK_KEY)
        if lock_raw:
            lock     = json.loads(lock_raw)
            job_id   = lock.get("job_id", "")
            prog_raw = r.get(f"benchmark:progress:{job_id}")
            progress = json.loads(prog_raw) if prog_raw else {}
            return JSONResponse(status_code=423, content={
                "locked":     True,
                "started_by": lock.get("admin_name", "Another admin"),
                "started_at": lock.get("started_at"),
                "job_id":     job_id,
                "progress":   progress,
            })

        last_raw = r.get(LAST_RUN_KEY)
        if last_raw:
            last = json.loads(last_raw)
            ttl  = r.ttl(LAST_RUN_KEY)
            return JSONResponse(status_code=429, content={
                "on_cooldown":       True,
                "completed_at":      last.get("completed_at"),
                "triggered_by_name": last.get("admin_name", "Admin"),
                "hours_remaining":   round(ttl / 3600, 1),
                "message":           f"Cooldown active — next run in {round(ttl / 3600, 1)}h",
            })
    except redis.exceptions.RedisError as e:
        print(f"⚠️ Redis connection error during trigger check: {e}")
        return JSONResponse(status_code=503, content={
            "error": "Redis service unavailable",
            "message": "Unable to connect to Redis cache/queue server. Please check internet connection or Redis service status."
        })

    
    task = run_benchmark.delay(admin_id, admin_name)

    # 📝 System Log
    log_event(
        level="INFO",
        action="BENCHMARK_TRIGGERED",
        actor_id=admin_id,
        actor_role="admin",
        metadata={
            "admin_name": admin_name,
            "job_id": task.id
        }
    )

    return JSONResponse(status_code=202, content={
        "status":  "queued",
        "job_id":  task.id,
        "message": "Benchmark started",
    })


# ── GET /benchmark/status ─────────────────────────────────
@router.get("/status")
async def get_benchmark_status(admin=Depends(require_admin)):
    try:
        lock_raw = r.get(LOCK_KEY)
        if not lock_raw:
            # print("🔍 Status: Idle")
            last_raw = r.get(LAST_RUN_KEY)
            return {
                "running":  False,
                "last_run": json.loads(last_raw) if last_raw else None,
            }
        lock     = json.loads(lock_raw)
        job_id   = lock.get("job_id", "")
        prog_raw = r.get(f"benchmark:progress:{job_id}")
        progress = json.loads(prog_raw) if prog_raw else {}
        if progress:
            print(f"⏳ Status: Running — {progress.get('percent', 0)}% ({progress.get('current', 0)}/{progress.get('total', 0)})")
        return {"running": True, "lock": lock, "progress": progress}
    except redis.exceptions.RedisError as e:
        print(f"⚠️ Redis connection error during status check: {e}")
        return {"running": False, "last_run": None, "error": "Redis connection unavailable"}


# ── GET /benchmark/results/latest ────────────────────────
@router.get("/results/latest")
async def get_latest_benchmark_results(admin=Depends(require_admin)):
    """
    Returns summary from benchmark_runs + per-image detail
    from benchmark_results for the most recent run.
    """
    latest_run = supabase_admin.table("benchmark_runs") \
        .select("*, "
                "benchmark_avg_iou:avg_iou, "
                "benchmark_bbox_accuracy:bbox_accuracy, "
                "benchmark_bbox_correct_count:bbox_correct_count, "
                "benchmark_iou_threshold:iou_threshold, "
                "benchmark_avg_roi_ms:avg_roi_ms, "
                "benchmark_bbox_regressions:bbox_regressions, "
                "benchmark_bbox_improvements:bbox_improvements, "
                "benchmark_tirads_accuracy:tirads_accuracy, "
                "benchmark_tirads_correct_count:tirads_correct_count, "
                "benchmark_feature_accuracy:feature_accuracy, "
                "benchmark_confusion_matrix:confusion_matrix, "
                "benchmark_avg_xception_ms:avg_xception_ms, "
                "benchmark_tirads_regressions:tirads_regressions, "
                "benchmark_tirads_improvements:tirads_improvements, "
                "benchmark_dataset_size:dataset_size") \
        .order("recorded_at", desc=True) \
        .limit(1) \
        .execute()
    
    if not latest_run.data:
        return {"summary": None, "results": []}

    run    = latest_run.data[0]
    run_id = run["id"]

    # 🚀 Check Redis Cache (TTL matching Signed URL expiry)
    from app.utils.cache import cache
    cache_key = f"benchmark_results_v2_{run_id}"
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    # Parse model_metadata if it's a string
    if isinstance(run.get("model_metadata"), str):
        try:
            import json
            run["model_metadata"] = json.loads(run["model_metadata"])
        except:
            pass

    results = supabase_admin.table("benchmark_results") \
        .select("*, result_id:id, performance_id:benchmark_run_id, "
                "benchmark_images(file_url, description)") \
        .eq("benchmark_run_id", run_id) \
        .order("image_index", desc=False) \
        .execute()
    
    results_list = results.data or []
    
    # ── Batch sign URLs for performance ──────────────────────
    paths_to_sign = []
    path_to_img_map = {}

    for r in results_list:
        img_data = r.get("benchmark_images")
        if isinstance(img_data, list) and len(img_data) > 0:
            img_data = img_data[0]
            r["benchmark_images"] = img_data
            
        if img_data and img_data.get("file_url"):
            url = img_data["file_url"]
            if STORAGE_BUCKET in url:
                path = url.split(f"{STORAGE_BUCKET}/")[-1]
                paths_to_sign.append(path)
                if path not in path_to_img_map:
                    path_to_img_map[path] = []
                path_to_img_map[path].append(img_data)

    if paths_to_sign:
        try:
            # Sign all URLs in a single batch (3600s = 1h)
            signed_urls = supabase_admin.storage.from_(STORAGE_BUCKET).create_signed_urls(paths_to_sign, 3600)
            
            # Create a lookup map for signed URLs
            signed_map = {item["path"]: item.get("signedURL") or item.get("signed_url") for item in signed_urls}
            
            # Map them back to the results
            for path, imgs in path_to_img_map.items():
                signed_url = signed_map.get(path)
                if signed_url:
                    for img in imgs:
                        img["file_url"] = signed_url
        except Exception as e:
            print(f"⚠️ Batch URL signing failed: {e}")

    final_response = {
        "summary": run,
        "results": results_list,
    }

    # 🚀 Store in Cache for 50 minutes (3000s)
    cache.set(cache_key, final_response, ttl=3000)

    return final_response


# ── GET /benchmark/history ────────────────────────────────
@router.get("/history")
async def get_benchmark_history(admin=Depends(require_admin)):
    history = supabase_admin.table("benchmark_runs") \
        .select("id, pipeline_version, model_metadata, recorded_at, "
                "benchmark_tirads_accuracy:tirads_accuracy, "
                "benchmark_bbox_accuracy:bbox_accuracy, "
                "benchmark_avg_iou:avg_iou, "
                "benchmark_feature_accuracy:feature_accuracy, "
                "benchmark_dataset_size:dataset_size, "
                "benchmark_tirads_regressions:tirads_regressions, "
                "benchmark_bbox_regressions:bbox_regressions, "
                "benchmark_avg_roi_ms:avg_roi_ms, "
                "benchmark_avg_xception_ms:avg_xception_ms") \
        .order("recorded_at", desc=True) \
        .execute()

    return {"history": history.data or []}