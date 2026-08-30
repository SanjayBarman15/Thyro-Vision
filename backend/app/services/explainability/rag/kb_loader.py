# app/services/explainability/rag/kb_loader.py
"""
Knowledge Base Loader for ACR TI-RADS MD files.

Parses the 5 TI-RADS markdown files (TR1–TR5) at startup and provides
a fast deterministic retrieval of the exact guideline text for any
feature combination. No embeddings. No vector DB. Pure text matching.
"""

import os
import re
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Point values per feature value (mirrors FEATURE_DEFINITIONS in xception_model.py)
_COMPOSITION_POINTS = {
    "cystic": 0, "spongiform": 0, "mixed_cystic_solid": 1,
    "solid": 2, "partially_cystic": 1,
    # KB text aliases
    "cystic or completely cystic": 0, "spongiform (>50% cystic)": 0,
    "mixed cystic and solid": 1, "solid or almost completely solid": 2,
}
_ECHOGENICITY_POINTS = {
    "anechoic": 0, "hyperechoic": 1, "isoechoic": 1, "hypoechoic": 2, "very_hypoechoic": 3,
    "hyper- or isoechoic": 1, "very hypoechoic": 3,
}
_SHAPE_POINTS = {
    "wider_than_tall": 0, "taller_than_wide": 3,
    "wider than tall": 0, "taller than wide": 3,
}
_MARGIN_POINTS = {
    "smooth": 0, "ill_defined": 0, "lobulated": 2, "irregular": 2, "extrathyroidal_extension": 3,
    "ill-defined": 0, "lobulated or irregular": 2, "extra-thyroidal extension": 3,
}
_ECHOGENIC_FOCI_POINTS = {
    "none": 0, "macrocalcifications": 1, "peripheral": 2,
    "punctate_echogenic_foci": 3, "microcalcifications": 3,
    "large comet-tail artifact": 0, "peripheral/rim calcifications": 2,
    "punctate echogenic foci": 3,
}

# TR level thresholds (ACR 2017)
_TIRADS_THRESHOLDS = [
    (0, 0, 1),
    (2, 2, 2),
    (3, 3, 3),
    (4, 6, 4),
    (7, 999, 5),
]

# Canonical display names for KB matching
_COMPOSITION_LABELS = {
    "cystic": "cystic or completely cystic",
    "spongiform": "spongiform",
    "mixed_cystic_solid": "mixed cystic and solid",
    "solid": "solid or almost completely solid",
    "partially_cystic": "mixed cystic and solid",
}
_ECHOGENICITY_LABELS = {
    "anechoic": "anechoic",
    "hyperechoic": "hyper- or isoechoic",
    "isoechoic": "hyper- or isoechoic",
    "hypoechoic": "hypoechoic",
    "very_hypoechoic": "very hypoechoic",
}
_SHAPE_LABELS = {
    "wider_than_tall": "wider than tall",
    "taller_than_wide": "taller than wide",
}
_MARGIN_LABELS = {
    "smooth": "smooth",
    "ill_defined": "ill-defined",
    "lobulated": "lobulated or irregular",
    "irregular": "lobulated or irregular",
    "extrathyroidal_extension": "extra-thyroidal extension",
}
_ECHOGENIC_FOCI_LABELS = {
    "none": "none",
    "macrocalcifications": "macrocalcifications",
    "peripheral": "peripheral/rim calcifications",
    "punctate_echogenic_foci": "punctate echogenic foci",
    "microcalcifications": "punctate echogenic foci",
}


class KBLoader:
    """
    Loads and indexes all 5 ACR TI-RADS Knowledge Base markdown files.
    Provides exact guideline text retrieval by feature combination.
    """

    def __init__(self):
        self._kb_index: Dict[int, list] = {}  # tr_level → list of parsed combination blocks
        self._loaded = False
        self._kb_dir: Optional[Path] = None

    def _find_kb_dir(self) -> Optional[Path]:
        """Locate the Knowledge Base directory relative to the project root."""
        candidates = []
        
        # Add all parent directories of this file safely
        for p in Path(__file__).parents:
            candidates.append(p / "Knowledge Base")
            
        # Add current working directory options
        candidates.extend([
            Path(os.getcwd()) / "Knowledge Base",
            Path(os.getcwd()).parent / "Knowledge Base",
        ])
        
        for c in candidates:
            try:
                if c.exists():
                    return c
            except Exception:
                continue
        return None

    def load(self):
        """Parse all KB files. Called once at startup."""
        if self._loaded:
            return

        self._kb_dir = self._find_kb_dir()
        if not self._kb_dir:
            logger.error("⚠️  Knowledge Base directory not found — RAG will use fallback mode.")
            self._loaded = True
            return

        for tr_level in range(1, 6):
            md_file = self._kb_dir / f"ACR TI-RADS_TR{tr_level}.md"
            if not md_file.exists():
                logger.warning(f"KB file missing: {md_file}")
                continue
            self._kb_index[tr_level] = self._parse_md_file(md_file, tr_level)
            logger.info(f"✅ KB TR{tr_level}: loaded {len(self._kb_index[tr_level])} combinations")

        self._loaded = True

    def _parse_md_file(self, path: Path, tr_level: int) -> list:
        """Parse a TI-RADS MD file into a list of combination blocks."""
        text = path.read_text(encoding="utf-8")
        # Split on "## Combination N" headers
        blocks = re.split(r"## Combination \d+", text)[1:]  # skip file header
        combinations = []
        for block in blocks:
            combo = self._parse_combination_block(block, tr_level)
            if combo:
                combinations.append(combo)
        return combinations

    def _parse_combination_block(self, block: str, tr_level: int) -> Optional[Dict]:
        """Extract structured data from a single combination block."""
        def extract(label: str) -> str:
            m = re.search(rf"\*\*{re.escape(label)}:\*\*\s*(.+)", block)
            return m.group(1).strip() if m else ""

        composition = extract("Composition").lower()
        echogenicity = extract("Echogenicity").lower()
        shape = extract("Shape").lower()
        margin = extract("Margin").lower()
        echogenic_foci = extract("Echogenic foci").lower()

        # Extract analysis text (between **Analysis:** and --- or end)
        analysis_match = re.search(r"\*\*Analysis:\*\*\s*(.*?)(?=---|\Z)", block, re.DOTALL)
        analysis_text = analysis_match.group(1).strip() if analysis_match else ""

        # Extract recommendation
        rec_match = re.search(r"\*\*Recommendation:\*\*\s*(.*?)(?=---|\Z)", block, re.DOTALL)
        recommendation = rec_match.group(1).strip() if rec_match else ""

        # Extract total points
        pts_match = re.search(r"\*\*Total points:\*\*\s*(\d+)", block)
        total_points = int(pts_match.group(1)) if pts_match else 0

        if not composition:
            return None

        return {
            "tr_level": tr_level,
            "total_points": total_points,
            "features": {
                "composition": composition,
                "echogenicity": echogenicity,
                "shape": shape,
                "margin": margin,
                "echogenic_foci": echogenic_foci,
            },
            "analysis_text": analysis_text,
            "recommendation": recommendation,
            "full_block": block.strip(),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def score_features(self, features: Dict[str, str]) -> Tuple[int, int, Dict]:
        """
        Deterministically score a set of 5 features.
        features: {"composition": "mixed_cystic_solid", "echogenicity": "hypoechoic", ...}
        Returns: (tirads_level, total_points, breakdown)
        """
        breakdown = {}
        total = 0

        def _resolve(feat_key: str, points_map: Dict, label_map: Dict, value: str) -> Tuple[int, str]:
            v = value.lower().strip()
            pts = points_map.get(v, points_map.get(v.replace("_", " "), 0))
            label = label_map.get(v, label_map.get(v.replace(" ", "_"), v))
            return pts, label

        feature_configs = [
            ("composition", _COMPOSITION_POINTS, _COMPOSITION_LABELS),
            ("echogenicity", _ECHOGENICITY_POINTS, _ECHOGENICITY_LABELS),
            ("shape", _SHAPE_POINTS, _SHAPE_LABELS),
            ("margin", _MARGIN_POINTS, _MARGIN_LABELS),
            ("echogenic_foci", _ECHOGENIC_FOCI_POINTS, _ECHOGENIC_FOCI_LABELS),
        ]

        for feat, pts_map, lbl_map in feature_configs:
            raw = features.get(feat, "")
            pts, label = _resolve(feat, pts_map, lbl_map, raw)

            # TR1 override: spongiform / cystic = auto TR1
            if feat == "composition" and raw in ("spongiform", "cystic", "cystic or completely cystic"):
                breakdown[feat] = {"value": label, "points": 0, "auto_tr1": True}
                total = 0  # force 0 — TR1 auto-classification
                break

            total += pts
            breakdown[feat] = {"value": label, "points": pts}

        # Determine TI-RADS level
        tirads = 1
        for lo, hi, tr in _TIRADS_THRESHOLDS:
            if lo <= total <= hi:
                tirads = tr
                break

        return tirads, total, breakdown

    def retrieve_kb_text(self, features: Dict[str, str]) -> Tuple[str, str, int, int]:
        """
        Main retrieval function.
        Given a dict of 5 feature values, returns:
          (analysis_text, recommendation, tirads_level, total_points)
        """
        if not self._loaded:
            self.load()

        tirads, total_points, breakdown = self.score_features(features)

        # Find best-matching combination in the KB for this TR level
        combos = self._kb_index.get(tirads, [])
        best = self._find_best_match(features, combos, tirads)

        if best:
            return best["analysis_text"], best["recommendation"], tirads, total_points

        # Fallback: return generic guideline text
        fallback_recs = {
            1: "No FNA or follow-up required.",
            2: "No FNA or follow-up required.",
            3: "Follow-up ultrasound at 1, 3, and 5 years if ≥1.5 cm. FNA if ≥2.5 cm.",
            4: "Follow-up at 1, 2, 3, and 5 years if ≥1.0 cm. FNA if ≥1.5 cm.",
            5: "Annual follow-up for up to 5 years if ≥0.5 cm. FNA if ≥1.0 cm.",
        }
        fallback_analysis = (
            f"This nodule scores {total_points} points under ACR TI-RADS 2017, "
            f"placing it in the TR{tirads} category."
        )
        return fallback_analysis, fallback_recs.get(tirads, ""), tirads, total_points

    def _find_best_match(self, target_features: Dict[str, str], combos: list, tirads: int) -> Optional[Dict]:
        """
        Find the combination entry that best matches the target feature set.
        Uses exact label matching with fuzzy scoring fallback.
        """
        if not combos:
            return None

        # Canonical KB labels for the given feature values
        target_labels = {
            "composition": _COMPOSITION_LABELS.get(target_features.get("composition", ""), ""),
            "echogenicity": _ECHOGENICITY_LABELS.get(target_features.get("echogenicity", ""), ""),
            "shape": _SHAPE_LABELS.get(target_features.get("shape", ""), ""),
            "margin": _MARGIN_LABELS.get(target_features.get("margin", ""), ""),
            "echogenic_foci": _ECHOGENIC_FOCI_LABELS.get(target_features.get("echogenic_foci", ""), ""),
        }

        best_score = -1
        best_combo = None

        for combo in combos:
            score = 0
            for feat, label in target_labels.items():
                kb_val = combo["features"].get(feat, "")
                if label and (label in kb_val or kb_val in label):
                    score += 1
            if score > best_score:
                best_score = score
                best_combo = combo

        return best_combo


# Singleton — loaded once at startup
kb_loader = KBLoader()
