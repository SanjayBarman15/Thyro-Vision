// components/admin/benchmark/IoUDistributionChart.tsx
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { BenchmarkResult } from './types'

interface Props {
  results: BenchmarkResult[]
}

export default function IoUDistributionChart({ results }: Props) {
  // ── Group into buckets 0.0-0.1, 0.1-0.2, etc. ──────────
  const buckets = [
    { range: '0.0-0.2', count: 0, color: '#ef4444' }, // red
    { range: '0.2-0.4', count: 0, color: '#f97316' }, // orange
    { range: '0.4-0.6', count: 0, color: '#eab308' }, // yellow
    { range: '0.6-0.8', count: 0, color: '#84cc16' }, // lime
    { range: '0.8-1.0', count: 0, color: '#22c55e' }, // green
  ]

  results.forEach(r => {
    const iou = r.iou_score ?? 0
    if (iou < 0.2) buckets[0].count++
    else if (iou < 0.4) buckets[1].count++
    else if (iou < 0.6) buckets[2].count++
    else if (iou < 0.8) buckets[3].count++
    else buckets[4].count++
  })

  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        IoU Score Distribution
      </h4>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
            <XAxis 
              dataKey="range" 
              tick={{ fill: '#64748b', fontSize: 10 }} 
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#64748b', fontSize: 10 }} 
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip 
              cursor={{ fill: '#1e2736', opacity: 0.4 }}
              contentStyle={{ 
                backgroundColor: '#1e2736', 
                border: '1px solid #2d3748',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fff'
              }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {buckets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
