// components/admin/curation/annotation/types.ts

export interface BBoxData {
  x: number
  y: number
  width: number
  height: number
  format: string
  image_width: number
  image_height: number
  coordinate_space?: string
}

export interface ACRFeature {
  index: number
  value: string
  points: number
  description: string
}

export interface ACRFeatures {
  composition:    ACRFeature | null
  echogenicity:   ACRFeature | null
  shape:          ACRFeature | null
  margin:         ACRFeature | null
  echogenic_foci: ACRFeature | null
}

export interface AnnotationState {
  bbox:     BBoxData | null
  features: ACRFeatures
  notes:    string
  tirads:   number | null
  points:   number
}

// ── ACR Feature Definitions ───────────────────────────────
// Values MUST match the Pascal VOC XML vocabulary used during training.
// e.g. 'mixed cystic and solid' not 'mixed_cystic_solid'
// e.g. 'very hypoechoic' not 'very_hypoechoic'
// Margin field maps to <margins> (plural) in XML.
export const ACR_FEATURES = {
  composition: {
    label: 'Composition',
    options: [
      { index: 0, value: 'cystic',                 points: 0, description: 'Cystic or almost completely cystic' },
      { index: 1, value: 'mixed cystic and solid',  points: 1, description: 'Mixed cystic and solid'             },
      { index: 2, value: 'solid',                  points: 2, description: 'Solid or almost completely solid'   },
      { index: 3, value: 'spongiform',              points: 0, description: 'Spongiform'                         },
    ],
  },
  echogenicity: {
    label: 'Echogenicity',
    options: [
      { index: 0, value: 'anechoic',               points: 0, description: 'Anechoic'                           },
      { index: 1, value: 'hyperechoic',             points: 1, description: 'Hyperechoic or isoechoic'           },
      { index: 2, value: 'hypoechoic',              points: 2, description: 'Hypoechoic (darker than thyroid)'   },
      { index: 3, value: 'very hypoechoic',         points: 3, description: 'Very hypoechoic'                    },
    ],
  },
  shape: {
    label: 'Shape',
    options: [
      { index: 0, value: 'wider than tall',         points: 0, description: 'Wider than tall'                    },
      { index: 1, value: 'taller than wide',        points: 3, description: 'Taller than wide (suspicious)'      },
    ],
  },
  margin: {
    label: 'Margin',
    // Note: stored as 'margin' in DB/frontend but exported as <margins> in XML
    options: [
      { index: 0, value: 'smooth',                     points: 0, description: 'Smooth margins'                  },
      { index: 1, value: 'ill-defined',                points: 0, description: 'Ill-defined margins'             },
      { index: 2, value: 'lobulated or irregular',     points: 2, description: 'Lobulated or irregular'          },
      { index: 3, value: 'extra-thyroidal extension',  points: 3, description: 'Extra-thyroidal extension'       },
    ],
  },
  echogenic_foci: {
    label: 'Echogenic Foci',
    options: [
      { index: 0, value: 'none',                       points: 0, description: 'None or large comet-tail'        },
      { index: 1, value: 'macrocalcifications',        points: 1, description: 'Macrocalcifications'             },
      { index: 2, value: 'peripheral calcifications',  points: 2, description: 'Peripheral (rim) calcifications' },
      { index: 3, value: 'punctate echogenic foci',    points: 3, description: 'Punctate echogenic foci'         },
    ],
  },
} as const

// ── TI-RADS calculation (mirrors Python tirads.py) ────────
// ACR 2017 point system:
//   0 pts   → TR1 (Benign)
//   2 pts   → TR2 (Not suspicious)
//   3 pts   → TR3 (Mildly suspicious)
//   4-6 pts → TR4 (Moderately suspicious)
//   7+ pts  → TR5 (Highly suspicious)
// Note: 1 point → TR1 (not handled in original Python — this is the fix)
export function calculateTirads(points: number): number {
  if (points <= 1) return 1
  if (points === 2) return 2
  if (points === 3) return 3
  if (points >= 4 && points <= 6) return 4
  return 5
}

// ── Total points from selected features ──────────────────
export function calculatePoints(features: ACRFeatures): number {
  return Object.values(features).reduce(
    (sum, f) => sum + (f?.points ?? 0),
    0
  )
}