// components/admin/logs/LogsStatsBar.tsx
'use client'

import { LogStats, LogLevel } from './types'

interface Props {
  stats: LogStats[]
}

// ── Level config ──────────────────────────────────────────
const LEVEL_CONFIG: Record<LogLevel, {
  label: string
  bg: string
  text: string
  border: string
  dot: string
}> = {
  INFO: {
    label: 'Info',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  WARN: {
    label: 'Warnings',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400',
  },
  ERROR: {
    label: 'Errors',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
  FATAL: {
    label: 'Fatal',
    bg: 'bg-red-900/20',
    text: 'text-red-300',
    border: 'border-red-900/40',
    dot: 'bg-red-300 animate-pulse',
  },
}

const LEVEL_ORDER: LogLevel[] = ['INFO', 'WARN', 'ERROR', 'FATAL']

export default function LogsStatsBar({ stats }: Props) {
  // Build a map for quick lookup
  const statsMap = stats.reduce<Record<string, number>>((acc, s) => {
    acc[s.level] = Number(s.count)
    return acc
  }, {})

  const total = Object.values(statsMap).reduce((a, b) => a + b, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">

      {/* Total */}
      <div className="bg-[#0f1623] border border-[#1e2736] rounded-lg p-4
                      flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Total Logs</span>
        <span className="text-2xl font-bold text-white">
          {total.toLocaleString()}
        </span>
      </div>

      {/* Per level */}
      {LEVEL_ORDER.map((level) => {
        const config = LEVEL_CONFIG[level]
        const count = statsMap[level] ?? 0

        return (
          <div
            key={level}
            className={`${config.bg} border ${config.border}
                        rounded-lg p-4 flex flex-col gap-1`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
              <span className={`text-xs ${config.text}`}>
                {config.label}
              </span>
            </div>
            <span className={`text-2xl font-bold ${config.text}`}>
              {count.toLocaleString()}
            </span>
          </div>
        )
      })}

    </div>
  )
}