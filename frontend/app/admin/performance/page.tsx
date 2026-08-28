// app/admin/performance/page.tsx

import { createClient } from '@/utils/supabase/server'
import PerformanceClient from '@/components/admin/performance/PerformanceClient'

export default async function PerformancePage() {
  const supabase = await createClient()

  const [
    { data: totalScans },
    { data: inferenceTime },
    { data: modelAccuracy },
    { data: flaggedCount },
    { data: feedbackRate },
    { data: tiradsData },
    { data: confidenceData },
    { data: accuracyHistory },
    { data: versionData },
  ] = await Promise.all([
    supabase.rpc('get_total_scans'),
    supabase.rpc('get_avg_inference_time'),
    supabase.rpc('get_model_accuracy'),
    supabase.rpc('get_flagged_count'),
    supabase.rpc('get_feedback_rate'),
    supabase.rpc('get_tirads_distribution'),
    supabase.rpc('get_confidence_distribution'),
    supabase.rpc('get_accuracy_over_time'),
    supabase.rpc('get_version_comparison'),
  ])

  return (
    <PerformanceClient
      initialData={{
        totalScans: totalScans ?? 0,
        inferenceTime: inferenceTime?.[0] ?? { ms: 0, seconds: 0 },
        modelAccuracy: modelAccuracy ?? null,
        flaggedCount: flaggedCount ?? 0,
        feedbackRate: feedbackRate ?? 0,
        tiradsData: tiradsData ?? [],
        confidenceData: confidenceData ?? [],
        accuracyHistory: accuracyHistory ?? [],
        versionData: versionData ?? [],
      }}
    />
  )
}