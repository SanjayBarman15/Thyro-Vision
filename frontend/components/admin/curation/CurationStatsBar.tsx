// components/admin/curation/CurationStatsBar.tsx
'use client'

import { CurationStats } from './types'

interface Props {
  stats: CurationStats
}

export default function CurationStatsBar({ stats }: Props) {
  // Derived value: how many approved labels have already been exported
  const alreadyExported = stats.total_approved - stats.total_new

  const cards = [
    {
      label:  'Pending Review',
      value:  stats.total_draft,
      bg:     'bg-[#0f1623]',
      border: 'border-[#1e2736]',
      text:   'text-white',
      sub:    null,
    },
    {
      label:  'In Review',
      value:  stats.total_claimed,
      bg:     'bg-yellow-500/5',
      border: 'border-yellow-500/20',
      text:   'text-yellow-400',
      sub:    'Currently claimed',
    },
    {
      label:  'Approved',
      value:  stats.total_approved,
      bg:     'bg-green-500/5',
      border: 'border-green-500/20',
      text:   'text-green-400',
      // Show breakdown: X new / Y already exported
      sub:    stats.total_approved > 0
                ? `${stats.total_new} new · ${alreadyExported} exported`
                : 'Ready to export',
    },
    {
      label:  'Rejected',
      value:  stats.total_rejected,
      bg:     'bg-red-500/5',
      border: 'border-red-500/20',
      text:   'text-red-400',
      sub:    null,
    },
    {
      label:  'Needs BBox',
      value:  stats.needs_bbox,
      bg:     'bg-blue-500/5',
      border: 'border-blue-500/20',
      text:   'text-blue-400',
      sub:    'Location correction',
    },
    {
      label:  'Needs TI-RADS',
      value:  stats.needs_tirads,
      bg:     'bg-purple-500/5',
      border: 'border-purple-500/20',
      text:   'text-purple-400',
      sub:    'Score correction',
    },
    {
      label:  'Needs Both',
      value:  stats.needs_both,
      bg:     'bg-orange-500/5',
      border: 'border-orange-500/20',
      text:   'text-orange-400',
      sub:    'Full annotation',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} border ${card.border}
                      rounded-lg p-4 flex flex-col gap-1`}
        >
          <span className="text-xs text-muted-foreground">
            {card.label}
          </span>
          <span className={`text-2xl font-bold ${card.text}`}>
            {card.value.toLocaleString()}
          </span>
          {card.sub && (
            <span className="text-xs text-muted-foreground">
              {card.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}