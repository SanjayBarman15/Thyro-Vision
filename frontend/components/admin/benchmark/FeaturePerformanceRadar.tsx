// components/admin/benchmark/FeaturePerformanceRadar.tsx
'use client'

import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { BenchmarkSummary, FEATURE_LABELS } from './types'

interface Props {
  summary: BenchmarkSummary | null
}

export default function FeaturePerformanceRadar({ summary }: Props) {
  if (!summary?.benchmark_feature_accuracy) return null

  const data = Object.entries(FEATURE_LABELS).map(([key, label]) => ({
    subject: label,
    accuracy: Math.round((summary.benchmark_feature_accuracy?.[key] ?? 0) * 100),
    fullMark: 100,
  }))

  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 h-[320px] flex flex-col">
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Feature Sensitivity Map
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Accuracy profile across all 5 anatomical features
        </p>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#1e2736" />
            <PolarAngleAxis 
              dataKey="subject" 
              stroke="#94a3b8" 
              fontSize={10} 
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              stroke="#475569" 
              fontSize={8} 
              tick={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e2736', borderRadius: '8px', fontSize: '10px' }}
            />
            <Radar
              name="Accuracy"
              dataKey="accuracy"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
