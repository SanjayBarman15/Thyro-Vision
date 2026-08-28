// components/admin/benchmark/BenchmarkProgressBar.tsx
'use client'

import { RefreshCw, Lock } from 'lucide-react'
import { BenchmarkStatus } from './types'

interface Props {
  status: BenchmarkStatus | null
}

export default function BenchmarkProgressBar({ status }: Props) {
  if (!status?.running || !status.progress) return null

  const { progress, lock } = status

  return (
    <div className="bg-[#0f1623] border border-purple-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="text-white font-medium">
            Benchmark running
          </span>
          {lock && (
            <span className="text-xs text-muted-foreground">
              — started by {lock.admin_name}
            </span>
          )}
        </div>
        <span className="text-purple-400 font-mono font-bold">
          {progress.current}/{progress.total} images ({progress.percent}%)
        </span>
      </div>

      {/* Progress bar line */}
      <div className="h-2 bg-[#1e2736] rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {/* Milestone labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 font-mono">
        {[0, 25, 50, 75, 100].map(m => (
          <span
            key={m}
            className={progress.percent >= m ? 'text-purple-400' : ''}
          >
            {m}%
          </span>
        ))}
      </div>
    </div>
  )
}
