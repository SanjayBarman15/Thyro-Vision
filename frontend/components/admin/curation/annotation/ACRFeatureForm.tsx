// components/admin/curation/annotation/ACRFeatureForm.tsx
'use client'

import { ACRFeatures, ACR_FEATURES, calculateTirads, calculatePoints } from './types'

interface Props {
  features: ACRFeatures
  onChange: (features: ACRFeatures) => void
}

// ── TI-RADS color ─────────────────────────────────────────
function getTiradsColor(tirads: number): string {
  if (tirads <= 2) return 'text-green-400'
  if (tirads === 3) return 'text-yellow-400'
  if (tirads === 4) return 'text-orange-400'
  return 'text-red-400'
}

export default function ACRFeatureForm({ features, onChange }: Props) {
  const points = calculatePoints(features)
  const tirads = calculateTirads(points)

  const handleSelect = (
    featureKey: keyof ACRFeatures,
    optionIndex: number
  ) => {
    const featureDef = ACR_FEATURES[featureKey]
    const option     = featureDef.options[optionIndex]

    onChange({
      ...features,
      [featureKey]: {
        index:       option.index,
        value:       option.value,
        points:      option.points,
        description: option.description,
      },
    })
  }

  return (
    <div className="space-y-4">

      {/* ── Feature dropdowns ── */}
      {(Object.keys(ACR_FEATURES) as (keyof typeof ACR_FEATURES)[]).map((key) => {
        const featureDef    = ACR_FEATURES[key]
        const selectedValue = features[key]

        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase
                                 tracking-wider">
                {featureDef.label}
              </label>
              {selectedValue && (
                <span className="text-xs font-bold text-white">
                  +{selectedValue.points} pts
                </span>
              )}
            </div>

            <select
              value={selectedValue?.index ?? ''}
              onChange={(e) => handleSelect(key, Number(e.target.value))}
              className="w-full bg-[#1e2736] border border-[#2d3748]
                         text-white text-sm rounded-lg px-3 py-2.5
                         focus:outline-none focus:border-[#4d5768]
                         cursor-pointer appearance-none"
            >
              <option value="" disabled>
                Select {featureDef.label.toLowerCase()}...
              </option>
              {featureDef.options.map((option) => (
                <option key={option.index} value={option.index}>
                  {option.description} (+{option.points}pts)
                </option>
              ))}
            </select>

            {/* Show selected description */}
            {selectedValue && (
              <p className="text-xs text-muted-foreground pl-1">
                {selectedValue.description}
              </p>
            )}
          </div>
        )
      })}

      {/* ── Live TI-RADS calculation ── */}
      <div className="mt-4 pt-4 border-t border-[#1e2736]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground uppercase
                            tracking-wider font-medium">
            ACR Point Total
          </span>
          <span className="text-sm font-bold text-white">
            {points} points
          </span>
        </div>

        {/* Points breakdown bar */}
        <div className="flex gap-1 mb-3">
          {(Object.keys(ACR_FEATURES) as (keyof typeof ACR_FEATURES)[]).map((key) => {
            const f = features[key]
            if (!f || f.points === 0) return null
            return (
              <div
                key={key}
                className="flex-1 h-1.5 rounded-full bg-purple-500/60"
                title={`${ACR_FEATURES[key].label}: +${f.points}pts`}
              />
            )
          })}
          {points === 0 && (
            <div className="flex-1 h-1.5 rounded-full bg-[#1e2736]" />
          )}
        </div>

        {/* Final TI-RADS result */}
        <div className={`flex items-center justify-between p-3 rounded-lg
                          border bg-[#0f1623]
                          ${tirads <= 2
                            ? 'border-green-500/20'
                            : tirads === 3
                            ? 'border-yellow-500/20'
                            : tirads === 4
                            ? 'border-orange-500/20'
                            : 'border-red-500/20'
                          }`}>
          <div>
            <span className="text-xs text-muted-foreground">
              Final TI-RADS Score
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {points === 0
                ? 'No features selected'
                : tirads === 1 ? 'Benign'
                : tirads === 2 ? 'Not suspicious'
                : tirads === 3 ? 'Mildly suspicious'
                : tirads === 4 ? 'Moderately suspicious'
                : 'Highly suspicious'
              }
            </p>
          </div>
          <span className={`text-3xl font-bold ${getTiradsColor(tirads)}`}>
            TR{tirads}
          </span>
        </div>

        {/* ACR point reference */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {[
            { tr: 1, pts: '0',  color: 'text-green-400',  bg: 'bg-green-500/10'  },
            { tr: 2, pts: '2',  color: 'text-green-300',  bg: 'bg-green-500/5'   },
            { tr: 3, pts: '3',  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { tr: 4, pts: '4-6',color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { tr: 5, pts: '7+', color: 'text-red-400',    bg: 'bg-red-500/10'    },
          ].map((item) => (
            <div
              key={item.tr}
              className={`${item.bg} rounded p-1.5 text-center
                           ${tirads === item.tr ? 'ring-1 ring-white/20' : ''}`}
            >
              <div className={`text-xs font-bold ${item.color}`}>
                TR{item.tr}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {item.pts}pts
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}