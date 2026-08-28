// components/admin/performance/types.ts

export interface InferenceTime {
  ms: number;
  seconds: number;
}

export interface TiradsItem {
  tirads_level: string;
  count: number;
}

export interface ConfidenceItem {
  bucket: string;
  count: number;
}

export interface AccuracyItem {
  recorded_at: string;
  model_version: string;
  accuracy: number;
  avg_confidence: number;
  avg_inference_ms: number;
}

export interface VersionItem {
  model_version: string;
  pipeline_version: string;
  model_metadata: {
    roi_detector: string;
    feature_classifier: string;
    rule_engine: string;
  } | null;
  total_predictions: number;
  correct_predictions: number;
  accuracy: number | null;
  avg_confidence: number | null;
  avg_inference_ms: number | null;
  tirads_distribution: Record<string, number> | null;
  feedback_rate: number | null;
  recorded_at: string;
}

export interface PerformanceData {
  totalScans: number;
  inferenceTime: InferenceTime;
  modelAccuracy: number | null;
  flaggedCount: number;
  feedbackRate: number;
  tiradsData: TiradsItem[];
  confidenceData: ConfidenceItem[];
  accuracyHistory: AccuracyItem[];
  versionData: VersionItem[];
}