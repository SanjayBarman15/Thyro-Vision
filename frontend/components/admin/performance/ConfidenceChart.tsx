// components/admin/performance/ConfidenceChart.tsx
'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { ConfidenceItem } from './types'
import { useEffect, useState } from 'react'

interface Props {
  data: ConfidenceItem[]
}

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-sm text-muted-foreground">No predictions yet</p>
      <span className="text-xs text-muted-foreground">
        Data appears here after first scan
      </span>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2736] border border-[#2d3748] rounded-lg p-3">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-sm text-muted-foreground">
        {payload[0].value} prediction{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────
export default function ConfidenceChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card className="bg-[#0f1623] border-[#1e2736]">
        <CardHeader>
          <CardTitle className="text-white text-base">Confidence Distribution</CardTitle>
          <CardDescription>Prediction count per confidence range</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Fill missing buckets with 0 so chart always shows all 5
  const allBuckets = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
  const filledData = allBuckets.map((bucket) => ({
    bucket,
    count: data.find((d) => d.bucket === bucket)?.count ?? 0,
  }))

  return (
    <Card className="bg-[#0f1623] border-[#1e2736]">
      <CardHeader>
        <CardTitle className="text-white text-base">
          Confidence Distribution
        </CardTitle>
        <CardDescription>
          Prediction count per confidence range
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={filledData}
              margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
            >
              <defs>
                <linearGradient
                  id="confidenceGradient"
                  x1="0" y1="0"
                  x2="0" y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#a855f7"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="#a855f7"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e2736"
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#a855f7"
                strokeWidth={2}
                fill="url(#confidenceGradient)"
                dot={{
                  fill: '#a855f7',
                  strokeWidth: 0,
                  r: 4,
                }}
                activeDot={{
                  fill: '#a855f7',
                  strokeWidth: 2,
                  stroke: '#1e2736',
                  r: 6,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}