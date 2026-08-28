// app/api/admin/benchmark/results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { parseBenchmarkResult, parseBenchmarkSummary } from '@/components/admin/benchmark/types'
import { redis } from '@/lib/redis'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'thyrovision-images'

  // 1. Try REDIS Cache first (Shared with Backend)
  if (redis) {
    try {
      const cached = await redis.get('benchmark_results_v2_latest')
      if (cached) {
        return NextResponse.json(JSON.parse(cached))
      }
    } catch (e) {
      console.warn('Redis cache lookup failed:', e)
    }
  }

  // 2. Try fetching from Backend (if Redis is empty or failed)
  try {
    const res = await fetch(`${backendUrl}/benchmark/results/latest`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
      // Shorter timeout to fallback to Supabase quickly if backend is down
      signal: AbortSignal.timeout(3000) 
    })
    if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
    }
  } catch (e) {
    console.warn('Backend reachability check failed, falling back to direct Supabase fetch')
  }

  // 2. FALLBACK: Direct Supabase Fetch (Backend-Independent)
  try {
    const adminSupabase = await createAdminClient()
    
    // Fetch latest run
    const { data: latestRunRaw } = await supabase
        .from('benchmark_runs')
        .select('*, benchmark_avg_iou:avg_iou, benchmark_bbox_accuracy:bbox_accuracy, benchmark_bbox_correct_count:bbox_correct_count, benchmark_iou_threshold:iou_threshold, benchmark_avg_roi_ms:avg_roi_ms, benchmark_bbox_regressions:bbox_regressions, benchmark_bbox_improvements:bbox_improvements, benchmark_tirads_accuracy:tirads_accuracy, benchmark_tirads_correct_count:tirads_correct_count, benchmark_feature_accuracy:feature_accuracy, benchmark_confusion_matrix:confusion_matrix, benchmark_avg_xception_ms:avg_xception_ms, benchmark_tirads_regressions:tirads_regressions, benchmark_tirads_improvements:tirads_improvements, benchmark_dataset_size:dataset_size')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

    if (!latestRunRaw) return NextResponse.json({ summary: null, results: [] })

    // Fetch results
    const { data: resultsRaw } = await supabase
        .from('benchmark_results')
        .select('*, result_id:id, performance_id:benchmark_run_id, benchmark_images(file_url, description)')
        .eq('benchmark_run_id', latestRunRaw.id)
        .order('image_index', { ascending: true })

    const parsedResults = (resultsRaw || []).map(parseBenchmarkResult)
    const summary = parseBenchmarkSummary(latestRunRaw)

    // Batch sign URLs
    const pathsToSign: string[] = []
    const pathToImages: Record<string, any[]> = {}

    parsedResults.forEach(r => {
        const img = r.benchmark_images
        const imgData = Array.isArray(img) ? img[0] : img
        if (imgData?.file_url?.includes(STORAGE_BUCKET)) {
            const path = imgData.file_url.split(`${STORAGE_BUCKET}/`)[1]
            if (path) {
                pathsToSign.push(path)
                if (!pathToImages[path]) pathToImages[path] = []
                pathToImages[path].push(imgData)
            }
        }
    })

    if (pathsToSign.length > 0) {
        const { data: signedUrls } = await adminSupabase.storage.from(STORAGE_BUCKET).createSignedUrls(pathsToSign, 3600)
        signedUrls?.forEach(item => {
            if (item.signedUrl && item.path && pathToImages[item.path]) {
                pathToImages[item.path].forEach(img => { if (img) img.file_url = item.signedUrl })
            }
        })
    }

    return NextResponse.json({ summary, results: parsedResults })
  } catch (err) {
    console.error('Hybrid fallback failed:', err)
    return NextResponse.json({ error: 'All fetch attempts failed' }, { status: 500 })
  }
}
