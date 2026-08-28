// app/api/admin/curation/export/route.ts
//
// Next.js server-side proxy route.
// Forwards the export request to FastAPI, passing through:
//   - mode query param (full | incremental)
//   - model_version_target (optional)
//   - notes (optional)
//   - the admin's auth token

import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export async function POST(req: NextRequest) {
  try {
    // ── Auth: get session token ───────────────────────────
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Forward query params to FastAPI ───────────────────
    // Pull mode, model_version_target, notes from the incoming request URL
    const incomingUrl   = new URL(req.url)
    const mode          = incomingUrl.searchParams.get('mode')          ?? 'full'
    const modelTarget   = incomingUrl.searchParams.get('model_version_target')
    const notes         = incomingUrl.searchParams.get('notes')

    // Build FastAPI URL with the same query params
    const backendUrl = new URL(`${BACKEND_URL}/admin/curation/export`)
    backendUrl.searchParams.set('mode', mode)
    if (modelTarget) backendUrl.searchParams.set('model_version_target', modelTarget)
    if (notes)       backendUrl.searchParams.set('notes', notes)

    // ── Proxy to FastAPI ──────────────────────────────────
    const response = await fetch(backendUrl.toString(), {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Export failed' }))
      return NextResponse.json(
        { detail: error.detail ?? 'Export failed' },
        { status: response.status }
      )
    }

    // ── Stream ZIP back to browser ────────────────────────
    const blob    = await response.blob()
    const headers = new Headers()

    // Pass through all FastAPI response headers the frontend needs
    const passthroughHeaders = [
      'Content-Disposition',
      'Content-Type',
      'X-Included-Labels',
      'X-Skipped-Labels',
      'X-Export-Mode',
      'X-Export-ID',
    ]
    for (const header of passthroughHeaders) {
      const val = response.headers.get(header)
      if (val) headers.set(header, val)
    }

    return new NextResponse(blob, { status: 200, headers })

  } catch (error) {
    console.error('[export route] error:', error)
    return NextResponse.json(
      { detail: 'Internal server error during export' },
      { status: 500 }
    )
  }
}