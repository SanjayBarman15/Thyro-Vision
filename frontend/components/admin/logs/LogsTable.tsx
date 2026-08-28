// components/admin/logs/LogsTable.tsx
'use client'

import { useState, Fragment } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, FileX } from 'lucide-react'
import { LogEntry, LogLevel } from './types'

interface Props {
  logs: LogEntry[]
  isRefreshing: boolean
}

// ── Level badge config ────────────────────────────────────
const LEVEL_CONFIG: Record<LogLevel, {
  bg: string
  text: string
  border: string
}> = {
  INFO: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  WARN: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
  },
  ERROR: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  FATAL: {
    bg: 'bg-red-900/20',
    text: 'text-red-300',
    border: 'border-red-900/40',
  },
}

// ── Level badge ───────────────────────────────────────────
function LevelBadge({ level }: { level: LogLevel }) {
  const config = LEVEL_CONFIG[level]
  return (
    <Badge className={`${config.bg} ${config.text} ${config.border}
                       font-mono text-xs`}>
      {level}
    </Badge>
  )
}

// ── Role badge ────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-muted-foreground text-xs">—</span>

  const config: Record<string, string> = {
    doctor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    admin:  'bg-green-500/10 text-green-400 border-green-500/20',
    system: 'bg-[#1e2736] text-muted-foreground border-[#2d3748]',
  }

  return (
    <Badge className={`${config[role] ?? config.system} text-xs`}>
      {role}
    </Badge>
  )
}

// ── Format timestamp ──────────────────────────────────────
function formatTimestamp(ts: string) {
  const date = new Date(ts)
  return {
    date: date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }
}

// ── Expanded row content ──────────────────────────────────
function ExpandedRow({ log }: { log: LogEntry }) {
  return (
    <TableRow className="border-[#1e2736] bg-[#080d14]">
      <TableCell colSpan={8} className="py-4 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Request ID */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase
                          tracking-wider">
              Request ID
            </p>
            <p className="font-mono text-xs text-white break-all">
              {log.request_id}
            </p>
          </div>

          {/* Resource */}
          {(log.resource_type || log.resource_id) && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium
                            uppercase tracking-wider">
                Resource
              </p>
              <p className="font-mono text-xs text-white">
                {log.resource_type && (
                  <span className="text-muted-foreground">
                    {log.resource_type}:{' '}
                  </span>
                )}
                {log.resource_id ?? '—'}
              </p>
            </div>
          )}

          {/* Actor ID */}
          {log.actor_id && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium
                            uppercase tracking-wider">
                Actor ID
              </p>
              <p className="font-mono text-xs text-white break-all">
                {log.actor_id}
              </p>
            </div>
          )}

          {/* Error message */}
          {log.error_message && (
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-red-400 font-medium uppercase
                            tracking-wider">
                Error Message
              </p>
              <p className="text-xs text-red-300 bg-red-500/5 border
                            border-red-500/10 rounded p-2">
                {log.error_message}
              </p>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-muted-foreground font-medium
                            uppercase tracking-wider">
                Metadata
              </p>
              <pre className="text-xs text-white bg-[#1e2736] border
                              border-[#2d3748] rounded p-3 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <FileX className="w-8 h-8 text-muted-foreground opacity-40" />
      <p className="text-sm text-muted-foreground">No logs found</p>
      <span className="text-xs text-muted-foreground">
        Try adjusting your filters
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────
export default function LogsTable({ logs, isRefreshing }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <Card className={`bg-[#0f1623] border-[#1e2736] transition-opacity
                      ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1e2736] hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-8" />
                  <TableHead className="text-muted-foreground">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Level
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Resource
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Error Code
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedRows.has(log.id)
                  const { date, time } = formatTimestamp(log.created_at)
                  const isCritical =
                    log.level === 'ERROR' || log.level === 'FATAL'

                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        onClick={() => toggleRow(log.id)}
                        className={`border-[#1e2736] cursor-pointer
                                    transition-colors
                                    ${isExpanded
                                      ? 'bg-[#1e2736]/50'
                                      : 'hover:bg-[#1e2736]/30'
                                    }
                                    ${isCritical
                                      ? 'border-l-2 border-l-red-500/50'
                                      : ''
                                    }`}
                      >
                        {/* Expand chevron */}
                        <TableCell className="w-8 pr-0">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          }
                        </TableCell>

                        {/* Timestamp */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-white">{time}</span>
                            <span className="text-xs text-muted-foreground">
                              {date}
                            </span>
                          </div>
                        </TableCell>

                        {/* Level */}
                        <TableCell>
                          <LevelBadge level={log.level} />
                        </TableCell>

                        {/* Action */}
                        <TableCell className="font-mono text-xs text-white">
                          {log.action}
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          <RoleBadge role={log.actor_role} />
                        </TableCell>

                        {/* Resource */}
                        <TableCell className="text-xs text-muted-foreground">
                          {log.resource_type ?? '—'}
                        </TableCell>

                        {/* Error code */}
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.error_code ?? '—'}
                        </TableCell>
                      </TableRow>

                      {/* Expanded content */}
                      {isExpanded && (
                        <ExpandedRow key={`${log.id}-expanded`} log={log} />
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}