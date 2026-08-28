# app/utils/image_processing.py
import io
import numpy as np
from PIL import Image, ImageDraw
import matplotlib.pyplot as plt

def draw_bounding_box(image_bytes: bytes, bbox: dict) -> bytes:
    """
    Draws a red bounding box over the ultrasound image.
    Supports both VOC (xmin, ymin, xmax, ymax) and xywh formats.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        draw = ImageDraw.Draw(img)

        # Check if we have VOC format (xmin, ymin, xmax, ymax)
        if all(k in bbox for k in ["xmin", "ymin", "xmax", "ymax"]):
            coords = [bbox["xmin"], bbox["ymin"], bbox["xmax"], bbox["ymax"]]
        # Or xywh format
        elif all(k in bbox for k in ["x", "y", "width", "height"]):
            coords = [bbox["x"], bbox["y"], bbox["x"] + bbox["width"], bbox["y"] + bbox["height"]]
        else:
            return image_bytes # Return original if bbox format is unknown

        draw.rectangle(coords, outline="red", width=4)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue()
    except Exception as e:
        print(f"Error drawing bounding box: {e}")
        return image_bytes

def convert_to_grayscale(image_bytes: bytes) -> bytes:
    """Converts image bytes to grayscale JPEG."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        gray = img.convert("L")
        out = io.BytesIO()
        gray.save(out, format="JPEG")
        return out.getvalue()
    except Exception as e:
        print(f"Error converting to grayscale: {e}")
        return image_bytes

def generate_gradcam_overlay(image_bytes: bytes, heatmap_299: list, bbox: dict) -> bytes:
    """
    Generates a Grad-CAM overlay.
    - image_bytes: The ORIGINAL full ultrasound image.
    - heatmap_299: The 299x299 upsampled heatmap (list of lists).
    - bbox: The bounding box (xywh) where the heatmap applies.
    """
    # 1. Load original image
    raw_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = raw_img.size
    
    # 2. Process heatmap
    heatmap = np.array(heatmap_299, dtype=np.float32)
    if heatmap.max() > 1.0 or heatmap.min() < 0.0:
        heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)

    # 3. Apply colormap
    heatmap_norm = np.uint8(255 * heatmap)
    colormap = plt.get_cmap("jet")
    heatmap_colored = colormap(heatmap_norm) # RGBA [0, 1]
    heatmap_colored = (heatmap_colored[:, :, :3] * 255).astype(np.uint8) # RGB [0, 255]
    heatmap_img = Image.fromarray(heatmap_colored)
    
    # 4. Extract ROI and blend
    ix, iy = int(bbox["x"]), int(bbox["y"])
    iw, ih = int(bbox["width"]), int(bbox["height"])
    
    # Boundary checks
    ix = max(0, min(ix, width - 1))
    iy = max(0, min(iy, height - 1))
    iw = max(1, min(iw, width - ix))
    ih = max(1, min(ih, height - iy))
    
    roi_img = raw_img.crop((ix, iy, ix + iw, iy + ih))
    heatmap_resized = heatmap_img.resize((iw, ih), Image.BILINEAR)
    
    # 5. Blend: 60% heatmap, 40% ROI
    blended_roi = Image.blend(roi_img, heatmap_resized, alpha=0.6)
    
    # 6. Paste back
    final_img = raw_img.copy()
    final_img.paste(blended_roi, (ix, iy))
    
    # Optional: Draw a subtle border around the ROI
    draw = ImageDraw.Draw(final_img)
    draw.rectangle([ix, iy, ix + iw, iy + ih], outline="yellow", width=2)
    
    buf = io.BytesIO()
    final_img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()
