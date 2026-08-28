// components/admin/curation/types.ts

export type CurationStatus = 'draft' | 'approved' | 'rejected'
export type FilterType = 'all' | 'bbox' | 'tirads' | 'both'
export type ExportMode = 'full' | 'incremental'

export interface CurationLabel {
  id: string
  raw_image_id: string
  status: CurationStatus
  tirads: number
  bounding_boxes: {
    x: number
    y: number
    width: number
    height: number
    format: string
    image_width: number
    image_height: number
  } | null
  corrected_features: Record<string, any> | null
  notes: string | null
  labeled_by: string
  approved: boolean
  claimed_by: string | null
  claimed_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  metadata: {
    needs_bbox_correction: boolean
    needs_tirads_correction: boolean
    bbox_issue: string | null
    ai_bbox: Record<string, any> | null
    ai_tirads: number | null
  } | null
  created_at: string
  // Export tracking — from combined solution
  exported_at: string | null         // null = never exported (your team's field)
  first_exported_in: string | null   // UUID of first export batch (your field)
  // joined
  claimer_name: string | null
  image_url: string | null
  ai_tirads: number | null
  doctor_tirads: number | null
  bbox_issue: string | null
}

export interface CurationStats {
  total_draft:    number
  total_approved: number
  total_rejected: number
  total_claimed:  number
  total_new:      number   // approved + exported_at IS NULL — NEW field
  needs_bbox:     number
  needs_tirads:   number
  needs_both:     number
}

// Shape of a row from the dataset_exports table
export interface DatasetExport {
  id:                   string
  exported_by:          string | null
  exported_at:          string
  label_count:          number
  image_count:          number
  skipped_count:        number
  export_mode:          ExportMode
  model_version_target: string | null
  pipeline_version:     string | null
  notes:                string | null
}