// components/admin/benchmark/types.ts

export interface BenchmarkStatus {
  running:   boolean
  lock?:     BenchmarkLock
  progress?: BenchmarkProgress
  last_run?: BenchmarkLastRun | null
}

export interface BenchmarkLock {
  admin_id:   string
  admin_name: string
  started_at: string
  job_id:     string
}

export interface BenchmarkProgress {
  current:  number
  total:    number
  percent:  number
  status:   'starting' | 'running' | 'complete' | 'error'
  job_id:   string
}

export interface BenchmarkLastRun {
  completed_at:  string
  triggered_by:  string
  admin_name:    string
  job_id:        string
}

// ── Summary interface — uses benchmark_ prefix ────────────
// DB table benchmark_runs has UNPREFIXED columns (bbox_accuracy etc.)
// parseBenchmarkSummary() remaps them to prefixed names here
// so BenchmarkResultsTable doesn't need changing
export interface BenchmarkSummary {
  id:               string
  model_version:    string
  pipeline_version: string
  model_metadata:   { roi_detector?: string; feature_classifier?: string; rule_engine?: string }
  recorded_at:      string

  // FasterRCNN — prefixed
  benchmark_avg_iou:            number | null
  benchmark_bbox_accuracy:      number | null
  benchmark_bbox_correct_count: number | null
  benchmark_iou_threshold:      number | null
  benchmark_avg_roi_ms:         number | null
  benchmark_bbox_regressions:   number | null
  benchmark_bbox_improvements:  number | null

  // Xception — prefixed
  benchmark_tirads_accuracy:      number | null
  benchmark_tirads_correct_count: number | null
  benchmark_feature_accuracy:     Record<string, number> | null
  benchmark_confusion_matrix:     number[][] | null
  benchmark_avg_xception_ms:      number | null
  benchmark_tirads_regressions:   number | null
  benchmark_tirads_improvements:  number | null

  benchmark_dataset_size: number | null
}

// ── Per-image result interface ────────────────────────────
// DB uses `id` — we remap to `result_id`
// DB uses `benchmark_run_id` — we remap to `performance_id`
export interface BenchmarkResult {
  result_id:          string        // ← remapped from DB `id`
  performance_id:     string        // ← remapped from DB `benchmark_run_id`
  benchmark_image_id: string
  image_description:  string
  image_index:        number

  // FasterRCNN
  predicted_bbox:        BBoxData | null
  ground_truth_bbox:     BBoxData | null
  iou_score:             number | null
  bbox_correct:          boolean | null
  roi_confidence:        number | null
  roi_inference_time_ms: number | null

  // Xception
  predicted_tirads:           number | null
  ground_truth_tirads:        number | null
  tirads_correct:             boolean | null
  tirads_delta:               number | null
  predicted_features:         Record<string, FeatureResult> | null
  ground_truth_features:      Record<string, FeatureResult> | null
  feature_accuracy:           Record<string, boolean> | null
  xception_inference_time_ms: number | null

  // Regression
  prev_predicted_tirads?: number | null
  prev_iou_score?:        number | null
  tirads_is_regression?:  boolean | null
  tirads_is_improvement?: boolean | null
  bbox_is_regression?:    boolean | null
  bbox_is_improvement?:   boolean | null

  // Joined image data (for gallery components)
  benchmark_images?: {
    file_url?:    string
    description?: string
    image_width?: number
    image_height?: number
  } | {
    file_url?:    string
    description?: string
    image_width?: number
    image_height?: number
  }[]

  grad_cam_data?: GradCamData | null
}

export interface BBoxData {
  x: number; y: number; width: number; height: number
  image_width?: number; image_height?: number
  xmin?: number; ymin?: number; xmax?: number; ymax?: number
}

export interface GradCamData {
  heatmap:           number[][]
  heatmap_shape:     [number, number]
  gradcam_available: boolean
  target_class?:     string
  target_layer?:     string
  top_features?:     string[]
  color_mapping?:    { colormap: string; min_value: number; max_value: number }
}

export interface FeatureResult {
  value:  string
  points: number
}

export interface BenchmarkHistoryRow {
  id:                           string
  model_version:                string
  pipeline_version:             string
  model_metadata:               Record<string, string>
  recorded_at:                  string
  benchmark_tirads_accuracy:    number | null
  benchmark_bbox_accuracy:      number | null
  benchmark_avg_iou:            number | null
  benchmark_feature_accuracy:   Record<string, number> | null
  benchmark_dataset_size:       number | null
  benchmark_tirads_regressions: number | null
  benchmark_bbox_regressions:   number | null
  benchmark_avg_roi_ms:         number | null
  benchmark_avg_xception_ms:    number | null
}

export const FEATURE_LABELS: Record<string, string> = {
  composition:    'Composition',
  echogenicity:   'Echogenicity',
  shape:          'Shape',
  margin:         'Margin',
  echogenic_foci: 'Echogenic Foci',
}

// ── JSON parse helper ─────────────────────────────────────
export function parseJsonField(val: any): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return val }
  }
  return val
}

// ── Parse benchmark_runs row → BenchmarkSummary ──────────
// KEY FIX: DB has unprefixed columns (bbox_accuracy, avg_iou...)
//          Interface expects benchmark_ prefixed names
//          This remap happens here so NO other component needs changing
export function parseBenchmarkSummary(s: any): BenchmarkSummary {
  return {
    // Identity
    id:               s.id,
    model_version:    s.pipeline_version,  // benchmark_runs has no model_version
    pipeline_version: s.pipeline_version,
    recorded_at:      s.recorded_at,
    model_metadata:   parseJsonField(s.model_metadata),

    // FasterRCNN — DB field → prefixed interface field
    benchmark_avg_iou:            s.avg_iou            ?? null,
    benchmark_bbox_accuracy:      s.bbox_accuracy       ?? null,
    benchmark_bbox_correct_count: s.bbox_correct_count  ?? null,
    benchmark_iou_threshold:      s.iou_threshold       ?? null,
    benchmark_avg_roi_ms:         s.avg_roi_ms          ?? null,
    benchmark_bbox_regressions:   s.bbox_regressions    ?? null,
    benchmark_bbox_improvements:  s.bbox_improvements   ?? null,

    // Xception — DB field → prefixed interface field
    benchmark_tirads_accuracy:      s.tirads_accuracy       ?? null,
    benchmark_tirads_correct_count: s.tirads_correct_count   ?? null,
    benchmark_feature_accuracy:     parseJsonField(s.feature_accuracy),
    benchmark_confusion_matrix:     parseJsonField(s.confusion_matrix),
    benchmark_avg_xception_ms:      s.avg_xception_ms        ?? null,
    benchmark_tirads_regressions:   s.tirads_regressions     ?? null,
    benchmark_tirads_improvements:  s.tirads_improvements    ?? null,

    benchmark_dataset_size: s.dataset_size ?? null,
  }
}

// ── Parse benchmark_results row → BenchmarkResult ────────
// KEY FIX: DB has `id` — remap to `result_id`
//          DB has `benchmark_run_id` — remap to `performance_id`
//          JSONB fields come as strings — parse them
export function parseBenchmarkResult(r: any): BenchmarkResult {
  return {
    // Remapped ID fields
    result_id:          r.id,                 // ← DB `id` → `result_id`
    performance_id:     r.benchmark_run_id,   // ← DB `benchmark_run_id` → `performance_id`

    // Direct field mappings
    benchmark_image_id:        r.benchmark_image_id,
    image_description:         r.image_description,
    image_index:               r.image_index,

    // JSONB fields — parse from string if needed
    predicted_bbox:        parseJsonField(r.predicted_bbox),
    ground_truth_bbox:     parseJsonField(r.ground_truth_bbox),
    predicted_features:    parseJsonField(r.predicted_features),
    ground_truth_features: parseJsonField(r.ground_truth_features),
    feature_accuracy:      parseJsonField(r.feature_accuracy),
    grad_cam_data:         parseJsonField(r.grad_cam_data),

    // Numeric / boolean fields
    iou_score:             r.iou_score,
    bbox_correct:          r.bbox_correct,
    roi_confidence:        r.roi_confidence,
    roi_inference_time_ms: r.roi_inference_time_ms,

    predicted_tirads:           r.predicted_tirads,
    ground_truth_tirads:        r.ground_truth_tirads,
    tirads_correct:             r.tirads_correct,
    tirads_delta:               r.tirads_delta,
    xception_inference_time_ms: r.xception_inference_time_ms,

    prev_predicted_tirads: r.prev_predicted_tirads,
    prev_iou_score:        r.prev_iou_score,
    tirads_is_regression:  r.tirads_is_regression,
    tirads_is_improvement: r.tirads_is_improvement,
    bbox_is_regression:    r.bbox_is_regression,
    bbox_is_improvement:   r.bbox_is_improvement,

    benchmark_images: r.benchmark_images,
  }
}

// ── Colour helpers ────────────────────────────────────────
export function tiradsColor(tirads: number | null): string {
  if (!tirads) return 'text-muted-foreground'
  if (tirads <= 2) return 'text-green-400'
  if (tirads === 3) return 'text-yellow-400'
  if (tirads === 4) return 'text-orange-400'
  return 'text-red-400'
}

export function iouColor(iou: number | null): string {
  if (iou === null) return 'text-muted-foreground'
  if (iou >= 0.7) return 'text-green-400'
  if (iou >= 0.5) return 'text-yellow-400'
  return 'text-red-400'
}