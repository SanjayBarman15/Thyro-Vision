// components/admin/benchmark/ConfidenceIoUScatter.tsx
'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Label,
} from 'recharts'
import { BenchmarkResult } from './types'

interface Props {
  results: BenchmarkResult[]
}

export default function ConfidenceIoUScatter({ results }: Props) {
  const data = results.map(r => ({
    confidence: Math.round((r.roi_confidence ?? 0) * 100),
    iou: Number((r.iou_score ?? 0).toFixed(3)),
    name: r.image_description || `Image ${r.image_index}`,
  }))

  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Confidence vs. IoU Calibration
      </h4>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
            <XAxis 
              type="number" 
              dataKey="confidence" 
              name="Confidence" 
              unit="%" 
              domain={[0, 100]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            >
              <Label 
                value="Confidence (%)" 
                position="bottom" 
                offset={-5} 
                style={{ fill: '#64748b', fontSize: '10px' }} 
              />
            </XAxis>
            <YAxis 
              type="number" 
              dataKey="iou" 
              name="IoU" 
              domain={[0, 1]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            >
              <Label 
                value="IoU Score" 
                angle={-90} 
                position="left" 
                offset={10} 
                style={{ fill: '#64748b', fontSize: '10px' }} 
              />
            </YAxis>
            <ZAxis type="number" range={[50, 50]} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#1e2736', 
                border: '1px solid #2d3748',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fff'
              }}
              itemStyle={{ color: '#fff' }}
            />
            <Scatter 
              name="Calibration" 
              data={data} 
              fill="#ef4444" 
              fillOpacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <p className="text-[10px] text-muted-foreground italic text-center">
        Ideal performance: points clustered in the top-right corner.
      </p>
    </div>
  )
}
