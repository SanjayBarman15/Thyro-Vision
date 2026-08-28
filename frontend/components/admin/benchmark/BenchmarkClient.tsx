// components/admin/benchmark/BenchmarkClient.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { goeyToast as toast } from '@/components/ui/goey-toaster'
import { BenchmarkStatus, BenchmarkSummary, BenchmarkResult, parseBenchmarkSummary, parseBenchmarkResult } from './types'
import BenchmarkResultsTable from './BenchmarkResultsTable'
import BenchmarkProgressBar from './BenchmarkProgressBar'
import { Play, Clock, Lock, RefreshCw } from 'lucide-react'

const supabase = createClient()
const POLL_MS  = 3000  // poll every 3s while benchmark is running

export default function BenchmarkClient({ 
  initialData 
}: { 
  initialData?: { summary: BenchmarkSummary | null; results: BenchmarkResult[] } 
}) {
  const [status,      setStatus]      = useState<BenchmarkStatus | null>(null)
  const [summary,     setSummary]     = useState<BenchmarkSummary | null>(initialData?.summary ?? null)
  const [results,     setResults]     = useState<BenchmarkResult[]>(initialData?.results ?? [])
  const [isTriggering, setIsTriggering] = useState(false)
  const [isLoadingResults, setIsLoadingResults] = useState(!initialData)

  // Track which milestones have already fired toasts
  const firedMilestonesRef = useRef(new Set<number>())
  const wasRunningRef      = useRef(false)
  const pollRef            = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch latest benchmark results ───────────────────────
  const fetchResults = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/benchmark/results')
      const data = await res.json()
      if (data.summary) setSummary(parseBenchmarkSummary(data.summary))
      if (data.results) setResults(data.results.map(parseBenchmarkResult))
    } catch (e) {
      console.error('Failed to fetch benchmark results:', e)
    } finally {
      setIsLoadingResults(false)
    }
  }, [])

  // ── Poll benchmark status ─────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/benchmark/status')
      const data: BenchmarkStatus = await res.json()
      setStatus(data)

      const pct = data.progress?.percent ?? 0

      // ── Milestone toasts ──────────────────────────────────
      if (data.running) {
        wasRunningRef.current = true
        const current = data.progress?.current ?? 0
        const total   = data.progress?.total ?? 20

        ;[25, 50, 75].forEach(milestone => {
          if (pct >= milestone && !firedMilestonesRef.current.has(milestone)) {
            firedMilestonesRef.current.add(milestone)
            toast(`Benchmark ${milestone}% complete`, {
              description: `${current}/${total} images processed`,
            })
          }
        })
      }

      // ── Completion detection ──────────────────────────────
      if (!data.running && wasRunningRef.current) {
        wasRunningRef.current = false
        firedMilestonesRef.current.clear()

        toast.success('Benchmark complete!', {
          description: 'Results are ready — page is refreshing',
        })

        // Stop polling and refresh results
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        await fetchResults()
      }
    } catch (e) {
      console.error('Benchmark status poll failed:', e)
    }
  }, [fetchResults])

  // ── Start/stop polling based on running state ─────────────
  useEffect(() => {
    // Always fetch status once on mount
    pollStatus()
    // Only fetch results if they weren't passed in from SSR
    if (!initialData) {
      fetchResults()
    }
  }, [pollStatus, fetchResults, initialData])

  useEffect(() => {
    if (status?.running && !pollRef.current) {
      // Start polling
      wasRunningRef.current = true
      pollRef.current = setInterval(pollStatus, POLL_MS)
    } else if (!status?.running && pollRef.current) {
      // Stop polling
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [status?.running, pollStatus])

  // ── Trigger benchmark ─────────────────────────────────────
  const triggerBenchmark = async () => {
    setIsTriggering(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res  = await fetch('/api/admin/benchmark/trigger', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.status === 202) {
        toast('Benchmark started', {
          description: '20 images queued — toasts at 25%, 50%, 75%, 100%',
        })
        firedMilestonesRef.current.clear()
        wasRunningRef.current = true
        // Start polling immediately
        await pollStatus()
      } else if (res.status === 423) {
        toast.error('Benchmark already running', {
          description: `Started by ${data.started_by} — ${data.progress?.percent ?? 0}% done`,
        })
      } else if (res.status === 429) {
        toast.error('Cooldown active', {
          description: data.message || 'Benchmark cooldown is active',
        })
      } else {
        toast.error('Failed to start benchmark', {
          description: data.detail || 'Unknown error',
        })
      }
    } catch (e) {
      toast.error('Network error', { description: 'Could not reach backend' })
    } finally {
      setIsTriggering(false)
    }
  }

  // ── Running state UI ──────────────────────────────────────
  const isRunning = status?.running ?? false
  const progress  = status?.progress
  const lock      = status?.lock

  return (
    <div className="space-y-6 p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Benchmark</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fixed test set — measures both model versions on identical images
          </p>
        </div>

        {/* Trigger button */}
        <button
          onClick={triggerBenchmark}
          disabled={isRunning || isTriggering}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                      border transition-colors cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isRunning
                        ? 'bg-[#1e2736] border-[#2d3748] text-muted-foreground'
                        : 'bg-purple-500/20 border-purple-500/40 text-purple-400 hover:bg-purple-500/30'
                      }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Benchmark
            </>
          )}
        </button>
      </div>

      {/* ── Running progress bar & metadata ── */}
      <BenchmarkProgressBar status={status} />

      {/* ── Locked by another admin (non-progress info) ── */}
      {isRunning && lock && !progress && (
        <div className="flex items-center gap-2 text-xs text-yellow-400
                         bg-yellow-500/5 border border-yellow-500/20
                         rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Benchmark locked by {lock.admin_name} — you will get a toast when it completes
        </div>
      )}

      {/* ── Last run info ── */}
      {!isRunning && status?.last_run && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Last run: {new Date(status.last_run.completed_at).toLocaleString()} by {status.last_run.admin_name}
          {' · '}6hr cooldown active
        </div>
      )}

      {/* ── Results ── */}
      {isLoadingResults ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <BenchmarkResultsTable
          results={results}
          summary={summary}
        />
      )}

    </div>
  )
}
