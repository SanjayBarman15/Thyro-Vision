// components/admin/performance/AccuracyChart.tsx
'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { BarChart2 } from 'lucide-react'
import { AccuracyItem } from './types'
import { useEffect, useState } from 'react'

interface Props {
  data: AccuracyItem[];
  title?: string;
  description?: string;
  hideConfidence?: boolean;
}

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-56 gap-3">
      <BarChart2 className="w-8 h-8 text-muted-foreground opacity-40" />
      <p className="text-sm font-medium text-muted-foreground">
        No performance history yet
      </p>
      <span className="text-xs text-muted-foreground text-center max-w-xs">
        Data appears here after the first model retrain.
        Complete the curation → training → redeploy cycle to populate this chart.
      </span>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2736] border border-[#2d3748] rounded-lg p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-xs text-muted-foreground capitalize">
            {entry.name}:
          </span>
          <span className="text-xs font-semibold text-white">
            {entry.name === 'avg_inference_ms'
              ? `${entry.value}ms`
              : `${entry.value}%`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Custom legend ─────────────────────────────────────────
function CustomLegend({ payload, hideConfidence }: any) {
  return (
    <div className="flex items-center gap-4 justify-center mt-2">
      {payload?.filter((e: any) => !(hideConfidence && e.value === 'avg_confidence')).map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="w-3 h-0.5 rounded-full inline-block"
            style={{ background: entry.color }}
          />
          <span className="text-xs text-muted-foreground capitalize">
            {entry.value === 'accuracy'
              ? 'Accuracy'
              : entry.value === 'avg_confidence'
              ? 'Avg Confidence'
              : 'Inference Time'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────
export default function AccuracyChart({
  data,
  title = "Performance Over Time",
  description = "Accuracy and confidence trends across model versions",
  hideConfidence = false,
}: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card className="bg-[#0f1623] border-[#1e2736]">
        <CardHeader>
          <CardTitle className="text-white text-base">Performance Over Time</CardTitle>
          <CardDescription>Accuracy and confidence trends across model versions</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Format recorded_at to readable date
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.recorded_at).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    }),
    // Convert accuracy and confidence to percentages
    accuracy: item.accuracy ? Number(item.accuracy.toFixed(1)) : 0,
    avg_confidence: item.avg_confidence
      ? Number((item.avg_confidence * 100).toFixed(1))
      : 0,
  }))

  return (
    <Card className="bg-[#0f1623] border-[#1e2736]">
      <CardHeader>
        <CardTitle className="text-white text-base">
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={formattedData}
              margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e2736"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend hideConfidence={hideConfidence} />} />

              {/* Accuracy line */}
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
                activeDot={{
                  fill: '#22c55e',
                  stroke: '#1e2736',
                  strokeWidth: 2,
                  r: 6,
                }}
              />

              {/* Avg confidence line */}
              {!hideConfidence && (
                <Line
                  type="monotone"
                  dataKey="avg_confidence"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
                  activeDot={{
                    fill: '#a855f7',
                    stroke: '#1e2736',
                    strokeWidth: 2,
                    r: 6,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}