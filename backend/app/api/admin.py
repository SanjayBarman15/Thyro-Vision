# app/api/admin.py
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.db.auth import require_admin
from datetime import datetime
from typing import Optional

# Services
from app.services.admin.performance_service import performance_service
from app.services.admin.dataset_export_service import dataset_export_service
from app.services.admin.export_history_service import export_history_service
from app.services.admin.cleanup_service import cleanup_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================================
# Performance Snapshot
# ============================================================

@router.post("/performance/snapshot")
async def record_performance_snapshot(
    admin=Depends(require_admin)
):
    """
    Computes and records a model performance snapshot.
    Delegates logic to PerformanceService.
    """
    return performance_service.record_snapshot(admin_id=admin["sub"])


# ============================================================
# Dataset Export — Pascal VOC ZIP
# ============================================================

@router.post("/curation/export")
async def export_dataset(
    mode: str = Query(default="full", pattern="^(full|incremental)$"),
    model_version_target: Optional[str] = Query(default=None),
    notes: Optional[str] = Query(default=None),
    admin=Depends(require_admin)
):
    """
    Exports approved training labels as a Pascal VOC ZIP.
    Delegates heavy pipeline logic to DatasetExportService.
    """
    zip_buffer, included, skipped, export_id = await dataset_export_service.export_dataset(
        mode=mode,
        model_version_target=model_version_target,
        notes=notes,
        admin_id=admin["sub"]
    )

    filename = (
        f"thyrovision-dataset-{mode}-"
        f"{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.zip"
    )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition":  f"attachment; filename={filename}",
            "X-Included-Labels":    str(included),
            "X-Skipped-Labels":     str(skipped),
            "X-Export-Mode":        mode,
            "X-Export-ID":          str(export_id or ""),
        }
    )


# ============================================================
# Export History — list past exports
# ============================================================

@router.get("/curation/export/history")
async def get_export_history(
    admin=Depends(require_admin)
):
    """Returns all past export runs."""
    return export_history_service.get_history()


# ============================================================
# Release Expired Claims
# ============================================================

@router.post("/curation/release-expired-claims")
async def release_expired_claims_endpoint(
    admin=Depends(require_admin)
):
    """Releases claims older than 30 minutes."""
    released = cleanup_service.release_expired_claims()
    return {"status": "ok", "released": released}