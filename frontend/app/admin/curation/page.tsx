// app/admin/curation/page.tsx
import { createClient } from '@/utils/supabase/server'
import CurationClient from '@/components/admin/curation/CurationClient'

export default async function CurationPage() {
  const supabase = await createClient()

  const [
    { data: labels },
    { data: stats },
  ] = await Promise.all([
    supabase.rpc('get_curation_queue', {
      p_limit: 50,
      p_offset: 0,
      p_filter: 'all',
    }),
    supabase.rpc('get_curation_stats'),
  ])

  return (
    <CurationClient
      initialLabels={labels ?? []}
      initialStats={stats?.[0] ?? {
        total_draft: 0,
        total_approved: 0,
        total_rejected: 0,
        total_claimed: 0,
        needs_bbox: 0,
        needs_tirads: 0,
        needs_both: 0,
      }}
    />
  )
}