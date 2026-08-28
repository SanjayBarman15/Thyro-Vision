# app/services/admin/dataset_export_service.py
import os
import io
import json
import zipfile
import httpx
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from app.db.supabase import get_supabase, STORAGE_BUCKET
from app.utils.logger import log_event
from app.utils.xml_utils import generate_pascal_voc_xml

class DatasetExportService:
    async def export_dataset(
        self,
        mode: str,
        model_version_target: Optional[str],
        notes: Optional[str],
        admin_id: str
    ):
        supabase = get_supabase()

        # ── Fetch labels based on mode ────────────────────────────
        query = supabase.table("training_labels") \
            .select("*") \
            .eq("status", "approved")

        if mode == "incremental":
            query = query.is_("exported_at", "null")

        labels_res = query.execute()
        labels = labels_res.data or []

        if not labels:
            if mode == "incremental":
                raise HTTPException(
                    status_code=400,
                    detail="No new labels to export. All approved labels have already been exported. "
                           "Use mode=full to re-export the complete dataset."
                )
            raise HTTPException(
                status_code=400,
                detail="No approved labels to export. Approve labels in the curation queue first."
            )

        # ── Build ZIP in memory ───────────────────────────────────
        zip_buffer    = io.BytesIO()
        included      = 0
        skipped       = 0
        skip_log      = []
        included_ids  = []

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for label in labels:
                raw_image_id       = label.get("raw_image_id")
                bbox               = label.get("bounding_boxes")
                tirads             = label.get("tirads")
                corrected_features = label.get("corrected_features") or {}

                if not raw_image_id or not bbox or not tirads or not corrected_features:
                    skip_log.append(f"{label.get('id')}: missing required fields")
                    skipped += 1
                    continue

                img_res = supabase.table("raw_images") \
                    .select("file_url, file_path") \
                    .eq("id", raw_image_id) \
                    .single() \
                    .execute()

                raw_image = img_res.data
                if not raw_image or not raw_image.get("file_url"):
                    skip_log.append(f"{raw_image_id}: image record not found")
                    skipped += 1
                    continue

                file_url   = raw_image["file_url"]
                file_path  = raw_image.get("file_path", "")
                
                # ── Handle Storage Paths vs URLs ─────────────────────
                download_url = file_url
                if not file_url.startswith("http"):
                    # It's a path, generate a short-lived signed URL
                    try:
                        res = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(file_url, 300)
                        download_url = res.get("signedURL") or res.get("signed_url")
                        if not download_url:
                            raise ValueError("Could not generate signed URL")
                    except Exception as e:
                        skip_log.append(f"{raw_image_id}: storage signing failed — {e}")
                        skipped += 1
                        continue
                elif STORAGE_BUCKET in file_url and "token=" not in file_url:
                    # It's a direct URL but might be expired or private
                    path = file_url.split(f"{STORAGE_BUCKET}/")[-1].split("?")[0]
                    try:
                        res = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(path, 300)
                        download_url = res.get("signedURL") or res.get("signed_url")
                    except:
                        pass # Fallback to original URL

                clean_path = download_url.split("?")[0]
                image_name = os.path.basename(file_path or clean_path)
                if not image_name or not image_name.endswith((".jpg", ".jpeg", ".png")):
                    image_name = f"{raw_image_id}.jpg"

                xml_name = image_name.rsplit(".", 1)[0] + ".xml"

                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.get(download_url)
                        resp.raise_for_status()
                        image_bytes = resp.content
                except Exception as e:
                    skip_log.append(f"{raw_image_id}: download failed — {e}")
                    skipped += 1
                    continue

                image_width  = int(bbox.get("image_width",  718))
                image_height = int(bbox.get("image_height", 500))

                xml_content = generate_pascal_voc_xml(
                    image_name=image_name,
                    image_width=image_width,
                    image_height=image_height,
                    bbox=bbox,
                    features=corrected_features,
                    tirads=tirads,
                )

                zf.writestr(f"dataset/images/{image_name}", image_bytes)
                zf.writestr(f"dataset/xmls/{xml_name}", xml_content)
                included += 1
                included_ids.append(label["id"])

            manifest = {
                "export_date":      datetime.utcnow().isoformat() + "Z",
                "export_mode":      mode,
                "total_approved":   len(labels),
                "included":         included,
                "skipped":          skipped,
                "skip_log":         skip_log,
                "pipeline_version": os.getenv("PIPELINE_VERSION", "unknown"),
                "model_version_target": model_version_target,
                "format":           "Pascal VOC XML",
                "xml_fields": {
                    "bndbox": "xyxy format (xmin/ymin/xmax/ymax)",
                    "tirads":  "composition, echogenicity, margins, echogenic_foci, shape, score, class",
                },
                "colab_instructions": {
                    "step_1": "Upload dataset/ folder to Google Drive at MyDrive/thyroid_dataset/Dataset/",
                    "step_2": "Run Colab preprocessing notebook to convert to .npy + 70-15-15 split",
                    "step_3": "Run FasterRCNN training notebook (reads images/ + xmls/)",
                    "step_4": "Run Xception training notebook (reads images/ + xmls/)",
                    "step_5": "Download new .pth weights and update .env version vars",
                    "step_6": "Rebuild Docker image and redeploy",
                }
            }
            zf.writestr("dataset/manifest.json", json.dumps(manifest, indent=2))

        if included == 0:
            reasons = "; ".join(skip_log[:3])
            if len(skip_log) > 3:
                reasons += " ..."
            raise HTTPException(
                status_code=400,
                detail=f"No labels could be exported. {skipped} labels were skipped. Reasons: {reasons}"
            )

        now_iso = datetime.utcnow().isoformat() + "Z"

        export_record_res = supabase.table("dataset_exports").insert({
            "exported_by":          admin_id,
            "exported_at":          now_iso,
            "label_count":          included,
            "image_count":          included,
            "skipped_count":        skipped,
            "export_mode":          mode,
            "model_version_target": model_version_target,
            "pipeline_version":     os.getenv("PIPELINE_VERSION", "unknown"),
            "notes":                notes,
        }).execute()

        export_record = export_record_res.data[0] if export_record_res.data else None
        export_id     = export_record["id"] if export_record else None

        log_event(
            level="INFO",
            action="DATASET_EXPORTED",
            actor_id=str(admin_id),
            actor_role="admin",
            resource_type="dataset_exports",
            resource_id=str(export_id) if export_id else None,
            metadata={
                "mode": mode,
                "label_count": included,
                "model_version_target": model_version_target
            }
        )

        if included_ids and export_id:
            supabase.table("training_labels") \
                .update({"exported_at": now_iso}) \
                .in_("id", included_ids) \
                .execute()

            supabase.table("training_labels") \
                .update({"first_exported_in": export_id}) \
                .in_("id", included_ids) \
                .is_("first_exported_in", "null") \
                .execute()

        zip_buffer.seek(0)
        return zip_buffer, included, skipped, export_id

# Global singleton
dataset_export_service = DatasetExportService()
