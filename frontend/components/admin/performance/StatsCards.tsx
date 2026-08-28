// components/admin/performance/StatsCards.tsx
'use client'

import { ScanLine, Timer, Target, Flag, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InferenceTime } from './types'

interface Props {
  totalScans: number
  inferenceTime: InferenceTime
  modelAccuracy: number | null
  flaggedCount: number
  feedbackRate: number
}

// ── Inference time color coding ───────────────────────────
function getInferenceColor(seconds: number) {
  if (seconds < 3) return 'text-green-500'
  if (seconds <= 7) return 'text-yellow-500'
  return 'text-red-500'
}

// ── Single stat card ──────────────────────────────────────
function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  valueClassName,
}: {
  title: string
  value: string
  subValue?: string
  icon: React.ElementType
  valueClassName?: string
}) {
  return (
    <Card className="bg-[#0f1623] border-[#1e2736]">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className={`text-2xl font-bold ${valueClassName ?? 'text-white'}`}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1">
            {subValue}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────
export default function StatsCards({
  totalScans,
  inferenceTime,
  modelAccuracy,
  flaggedCount,
  feedbackRate,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">

      {/* Total Scans */}
      <StatCard
        title="Total Scans"
        value={totalScans.toLocaleString()}
        icon={ScanLine}
      />

      {/* Avg Processing Time */}
      <StatCard
        title="Avg Processing Time"
        value={`${inferenceTime.seconds}s`}
        subValue={`${inferenceTime.ms.toLocaleString()}ms`}
        icon={Timer}
        valueClassName={getInferenceColor(inferenceTime.seconds)}
      />

      {/* Model Accuracy */}
      <StatCard
        title="Model Accuracy"
        value={modelAccuracy !== null ? `${modelAccuracy}%` : '—'}
        subValue={
          modelAccuracy !== null
            ? 'Based on doctor feedback'
            : 'Awaiting feedback'
        }
        icon={Target}
        valueClassName={
          modelAccuracy === null
            ? 'text-muted-foreground'
            : modelAccuracy >= 80
            ? 'text-green-500'
            : modelAccuracy >= 60
            ? 'text-yellow-500'
            : 'text-red-500'
        }
      />

      {/* Flagged for Review */}
      <StatCard
        title="Flagged for Review"
        value={flaggedCount.toLocaleString()}
        subValue={flaggedCount > 0 ? 'Needs curation' : 'Nothing pending'}
        icon={Flag}
        valueClassName={
          flaggedCount > 0 ? 'text-yellow-500' : 'text-white'
        }
      />

      {/* Feedback Rate */}
      <StatCard
        title="Feedback Rate"
        value={feedbackRate > 0 ? `${feedbackRate}%` : '—'}
        subValue={
          feedbackRate > 0
            ? 'Of predictions reviewed'
            : 'No feedback yet'
        }
        icon={MessageSquare}
        valueClassName={
          feedbackRate === 0 ? 'text-muted-foreground' : 'text-white'
        }
      />

    </div>
  )
}