// components/admin/benchmark/ConfusionMatrix.tsx
'use client'

interface Props {
  matrix: number[][] | null
}

const LABELS = ['TR1', 'TR2', 'TR3', 'TR4', 'TR5']

export default function ConfusionMatrix({ matrix }: Props) {
  if (!matrix || matrix.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm
                       text-muted-foreground">
        No confusion matrix data yet
      </div>
    )
  }

  // Find max value for colour scaling
  const maxVal = Math.max(...matrix.flat().filter(v => v > 0), 1)

  const cellColor = (row: number, col: number, val: number) => {
    if (val === 0) return 'bg-[#0f1623]'
    const intensity = val / maxVal
    // Diagonal (correct) → green, Off-diagonal (wrong) → red
    if (row === col) {
      if (intensity > 0.6) return 'bg-green-500/70'
      if (intensity > 0.3) return 'bg-green-500/40'
      return 'bg-green-500/20'
    } else {
      if (intensity > 0.6) return 'bg-red-500/70'
      if (intensity > 0.3) return 'bg-red-500/40'
      return 'bg-red-500/20'
    }
  }

  const totalCorrect = matrix.reduce((sum, row, i) => sum + row[i], 0)
  const total        = matrix.flat().reduce((a, b) => a + b, 0)
  const accuracy     = total > 0 ? Math.round((totalCorrect / total) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Rows = Ground Truth, Columns = Predicted
        </p>
        <span className="text-xs font-medium text-white">
          Overall: {totalCorrect}/{total} ({accuracy}%)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {/* Top-left corner */}
              <th className="w-12 h-8" />
              {/* Predicted headers */}
              {LABELS.map(label => (
                <th key={label}
                  className="w-14 h-8 text-[11px] font-semibold
                              text-muted-foreground text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Row label (ground truth) */}
                <td className="w-12 text-[11px] font-semibold
                                text-muted-foreground text-right pr-2">
                  {LABELS[rowIdx]}
                </td>
                {/* Cells */}
                {row.map((val, colIdx) => (
                  <td key={colIdx}
                    className={`w-14 h-10 text-center text-sm font-bold
                                border border-[#1e2736] transition-colors
                                ${cellColor(rowIdx, colIdx, val)}
                                ${rowIdx === colIdx ? 'text-green-300' : val > 0 ? 'text-red-300' : 'text-muted-foreground/30'}`}>
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500/40 inline-block" />
          Correct classification
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/40 inline-block" />
          Misclassification
        </span>
      </div>
    </div>
  )
}
