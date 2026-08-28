// app/admin/logs/page.tsx
import { createClient } from '@/utils/supabase/server'
import LogsClient from '@/components/admin/logs/LogsClient'

export default async function LogsPage() {
  const supabase = await createClient()

  const [
    { data: logs },
    { data: stats },
  ] = await Promise.all([
    supabase.rpc('get_system_logs', {
      p_limit: 50,
      p_offset: 0,
    }),
    supabase.rpc('get_log_stats'),
  ])

  return (
    <LogsClient
      initialLogs={logs ?? []}
      initialStats={stats ?? []}
    />
  )
}