// app/api/admin/benchmark/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  try {
    const res = await fetch(`${backendUrl}/benchmark/history`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
    }
  } catch (e) {
    console.warn('Benchmark history backend check failed, falling back to Supabase')
  }

  // FALLBACK: Fetch history from supabase
  try {
    const { data: runs } = await supabase
      .from('benchmark_runs')
      .select('*, benchmark_tirads_accuracy:tirads_accuracy, benchmark_bbox_accuracy:bbox_accuracy, benchmark_avg_iou:avg_iou, benchmark_feature_accuracy:feature_accuracy, benchmark_dataset_size:dataset_size, benchmark_tirads_regressions:tirads_regressions, benchmark_bbox_regressions:bbox_regressions, benchmark_avg_roi_ms:avg_roi_ms, benchmark_avg_xception_ms:avg_xception_ms')
      .order('recorded_at', { ascending: false })
      .limit(50)

    return NextResponse.json(runs || [])
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
