// app/api/admin/benchmark/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  try {
    const res = await fetch(`${backendUrl}/benchmark/status`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.timeout(2000)
    })
    if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
    }
  } catch (e) {
    console.warn('Benchmark status backend check failed, falling back to Supabase')
  }

  // FALLBACK: Query Supabase for latest run info to show as "last_run"
  try {
    const { data: lastRun } = await supabase
      .from('benchmark_runs')
      .select('recorded_at, triggered_by, pipeline_version')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      running: false,
      last_run: lastRun ? {
        completed_at: lastRun.recorded_at,
        triggered_by: lastRun.triggered_by,
        admin_name:   'Admin', // could join with profiles if needed
        job_id:       'supa-fallback'
      } : null
    })
  } catch {
    return NextResponse.json({ running: false, last_run: null })
  }
}
