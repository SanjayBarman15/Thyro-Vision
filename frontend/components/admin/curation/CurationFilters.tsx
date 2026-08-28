// components/admin/curation/CurationFilters.tsx
'use client'

import { FilterType, CurationStats } from './types'

interface Props {
  filter: FilterType
  onChange: (filter: FilterType) => void
  stats: CurationStats
}

const FILTERS: {
  value: FilterType
  label: string
  countKey: keyof CurationStats
  color: string
  activeColor: string
}[] = [
  {
    value: 'all',
    label: 'All Pending',
    countKey: 'total_draft',
    color: 'text-muted-foreground',
    activeColor: 'text-white bg-[#1e2736]',
  },
  {
    value: 'bbox',
    label: 'BBox Only',
    countKey: 'needs_bbox',
    color: 'text-muted-foreground',
    activeColor: 'text-blue-400 bg-blue-500/10',
  },
  {
    value: 'tirads',
    label: 'TI-RADS Only',
    countKey: 'needs_tirads',
    color: 'text-muted-foreground',
    activeColor: 'text-purple-400 bg-purple-500/10',
  },
  {
    value: 'both',
    label: 'Both',
    countKey: 'needs_both',
    color: 'text-muted-foreground',
    activeColor: 'text-orange-400 bg-orange-500/10',
  },
]

export default function CurationFilters({ filter, onChange, stats }: Props) {
  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-lg p-4">
      <div className="flex flex-wrap gap-2">

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-[#1e2736] rounded-lg p-1">
          {FILTERS.map((f) => {
            const count = stats[f.countKey] as number
            const isActive = filter === f.value

            return (
              <button
                key={f.value}
                onClick={() => onChange(f.value)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs
                            rounded-md transition-colors cursor-pointer
                            font-medium
                            ${isActive
                              ? f.activeColor
                              : `${f.color} hover:text-white`
                            }`}
              >
                {f.label}
                {/* Count badge */}
                <span
                  className={`inline-flex items-center justify-center
                               w-5 h-5 rounded-full text-[10px] font-bold
                               ${isActive
                                 ? 'bg-white/10'
                                 : 'bg-[#2d3748] text-muted-foreground'
                               }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Annotation type legend */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-muted-foreground">
              BBox — nodule location
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-xs text-muted-foreground">
              TI-RADS — classification
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-muted-foreground">
              Both — full annotation
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}