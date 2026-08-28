// components/admin/benchmark/TiradsDistributionChart.tsx
'use client'

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { BenchmarkResult } from './types'

interface Props {
  results: BenchmarkResult[]
}

export default function TiradsDistributionChart({ results }: Props) {
  // ── Compute distributions ───────────────────────────────
  const gtCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const predCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  results.forEach(r => {
    if (r.ground_truth_tirads) gtCounts[r.ground_truth_tirads]++
    if (r.predicted_tirads) predCounts[r.predicted_tirads]++
  })

  const data = [1, 2, 3, 4, 5].map(t => ({
    name: `TR${t}`,
    Truth: gtCounts[t],
    Predicted: predCounts[t],
  }))

  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 h-[320px] flex flex-col">
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          TI-RADS Distribution
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Comparison of Ground Truth vs. Model Prediction counts
        </p>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e2736', borderRadius: '8px', fontSize: '10px' }}
              itemStyle={{ fontSize: '10px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
              iconSize={8}
            />
            <Bar dataKey="Truth" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="Predicted" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
