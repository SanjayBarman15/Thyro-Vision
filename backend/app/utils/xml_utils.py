# app/utils/xml_utils.py

def generate_pascal_voc_xml(
    image_name: str,
    image_width: int,
    image_height: int,
    bbox: dict,      # xywh format from DB
    features: dict,  # ACR features from admin annotation
    tirads: int,
) -> str:
    """
    Generates Pascal VOC XML matching the exact format used during training.

    Critical requirements:
    - bndbox uses xyxy (xmin/ymin/xmax/ymax) — converted from xywh
    - feature values must match XML vocabulary exactly
      e.g. 'mixed cystic and solid' not 'mixed_cystic_solid'
    - <margins> is plural (not 'margin') — matches training XML format
    """
    # ── xywh → xyxy ──────────────────────────────────────
    xmin = int(bbox.get("x", 0))
    ymin = int(bbox.get("y", 0))
    xmax = int(bbox.get("x", 0) + bbox.get("width", 0))
    ymax = int(bbox.get("y", 0) + bbox.get("height", 0))

    def get_val(key: str) -> str:
        feature = features.get(key) or {}
        if isinstance(feature, dict):
            return str(feature.get("value", "")).strip()
        return ""

    composition    = get_val("composition")
    echogenicity   = get_val("echogenicity")
    margins        = get_val("margin")         # <margins> in XML (plural)
    echogenic_foci = get_val("echogenic_foci")
    shape          = get_val("shape")

    return f"""<?xml version='1.0' encoding='utf-8'?>
<annotation>
\t<folder>dataset</folder>
\t<filename>{image_name}</filename>
\t<size>
\t\t<width>{image_width}</width>
\t\t<height>{image_height}</height>
\t\t<depth>3</depth>
\t</size>
\t<segmented>0</segmented>
\t<object>
\t\t<name>1</name>
\t\t<pose>Unspecified</pose>
\t\t<truncated>0</truncated>
\t\t<difficult>0</difficult>
\t\t<bndbox>
\t\t\t<xmin>{xmin}</xmin>
\t\t\t<ymin>{ymin}</ymin>
\t\t\t<xmax>{xmax}</xmax>
\t\t\t<ymax>{ymax}</ymax>
\t\t</bndbox>
\t\t<tirads>
\t\t\t<composition>{composition}</composition>
\t\t\t<echogenicity>{echogenicity}</echogenicity>
\t\t\t<margins>{margins}</margins>
\t\t\t<echogenic_foci>{echogenic_foci}</echogenic_foci>
\t\t\t<shape>{shape}</shape>
\t\t\t<score>{tirads}</score>
\t\t\t<class>TR{tirads}</class>
\t\t</tirads>
\t</object>
</annotation>"""
