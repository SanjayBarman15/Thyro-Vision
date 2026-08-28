# app/utils/path_utils.py

def get_raw_image_path(doctor_id: str, patient_id: str, image_id: str, extension: str) -> str:
    """Generates the Supabase storage path for raw ultrasound images."""
    return f"raw/doctor_{doctor_id}/patient_{patient_id}/image_{image_id}.{extension}"

def get_processed_image_path(
    version: str, 
    tirads: int, 
    doctor_id: str, 
    patient_id: str, 
    image_id: str, 
    prefix: str = "image", 
    extension: str = "jpg"
) -> str:
    """Generates the Supabase storage path for processed images (grayscale, Grad-CAM, etc.)."""
    return (
        f"processed/{version}/"
        f"class-{tirads}/"
        f"doctor_{doctor_id}/"
        f"patient_{patient_id}/"
        f"{prefix}_{image_id}.{extension}"
    )
