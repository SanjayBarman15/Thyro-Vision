// components/admin/logs/types.ts

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
export type ActorRole = 'doctor' | 'system' | 'admin'

export interface LogEntry {
  id: string
  level: LogLevel
  action: string
  actor_id: string | null
  actor_role: ActorRole | null
  resource_type: string | null
  resource_id: string | null
  request_id: string
  metadata: Record<string, any> | null
  error_code: string | null
  error_message: string | null
  created_at: string
}

export interface LogStats {
  level: LogLevel
  count: number
}

export interface LogFilters {
  level: LogLevel | 'ALL'
  actor_role: ActorRole | 'ALL'
  search: string
  from: string   // ISO date string
  to: string     // ISO date string
}