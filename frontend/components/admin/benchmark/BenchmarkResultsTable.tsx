// components/admin/benchmark/BenchmarkResultsTable.tsx
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  BenchmarkResult, BenchmarkSummary,
  FEATURE_LABELS, tiradsColor, iouColor,
} from './types'
import ConfusionMatrix from './ConfusionMatrix'
import {
  TrendingDown, TrendingUp, Minus,
  CheckCircle, XCircle, AlertTriangle,
  Maximize2, Minimize2,
} from 'lucide-react'
import IoUDistributionChart from './IoUDistributionChart'
import ConfidenceIoUScatter from './ConfidenceIoUScatter'
import WorstResultsGallery from './WorstResultsGallery'
import TiradsDistributionChart from './TiradsDistributionChart'
import FeaturePerformanceRadar from './FeaturePerformanceRadar'
import ClassifierFailureGallery from './ClassifierFailureGallery'

interface Props {
  results:  BenchmarkResult[]
  summary:  BenchmarkSummary | null
}

// ── Regression badge ──────────────────────────────────────
function RegressionBadge({
  isRegression, isImprovement,
}: {
  isRegression: boolean | null
  isImprovement: boolean | null
}) {
  if (isRegression) return (
    <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
      <TrendingDown className="w-3 h-3" />
      Regression
    </span>
  )
  if (isImprovement) return (
    <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
      <TrendingUp className="w-3 h-3" />
      Improved
    </span>
  )
  return <Minus className="w-3 h-3 text-muted-foreground" />
}

// ── Feature accuracy pills ────────────────────────────────
function FeatureAccuracyPills({
  accuracy,
}: {
  accuracy: Record<string, boolean> | null
}) {
  if (!accuracy) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {Object.entries(FEATURE_LABELS).map(([key, label]) => {
        const correct = accuracy[key]
        return (
          <span
            key={key}
            title={label}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                        ${correct
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
          >
            {label.slice(0, 4)}
          </span>
        )
      })}
    </div>
  )
}

// ── Summary stat card ─────────────────────────────────────
function StatCard({
  label, value, sub, color = 'text-white',
}: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────
export default function BenchmarkResultsTable({ results, summary }: Props) {
  const [activeTab, setActiveTab] = useState<'roi' | 'xception'>('roi')

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <AlertTriangle className="w-8 h-8 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">No benchmark results yet</p>
        <p className="text-xs text-muted-foreground">
          Trigger a benchmark run from the Performance page
        </p>
      </div>
    )
  }

  // ── Per-model stats ───────────────────────────────────────
  const roiStats = {
    accuracy:    summary?.benchmark_bbox_accuracy,
    avgIou:      summary?.benchmark_avg_iou,
    correct:     summary?.benchmark_bbox_correct_count,
    total:       summary?.benchmark_dataset_size,
    avgMs:       summary?.benchmark_avg_roi_ms,
    regressions: summary?.benchmark_bbox_regressions,
    improvements: summary?.benchmark_bbox_improvements,
  }

  const xceptionStats = {
    accuracy:    summary?.benchmark_tirads_accuracy,
    correct:     summary?.benchmark_tirads_correct_count,
    total:       summary?.benchmark_dataset_size,
    avgMs:       summary?.benchmark_avg_xception_ms,
    regressions: summary?.benchmark_tirads_regressions,
    improvements: summary?.benchmark_tirads_improvements,
    features:    summary?.benchmark_feature_accuracy,
    confusion:   summary?.benchmark_confusion_matrix,
  }

  // ── Size-based stats calculation ──────────────────────
  const sizeStats = results.reduce((acc, r) => {
    if (!r.ground_truth_bbox) return acc
    const area = r.ground_truth_bbox.width * r.ground_truth_bbox.height
    const isSmall = area < 3000 
    
    if (isSmall) {
      acc.smallTotal++
      if (r.bbox_correct) acc.smallCorrect++
    } else {
      acc.largeTotal++
      if (r.bbox_correct) acc.largeCorrect++
    }
    return acc
  }, { smallTotal: 0, smallCorrect: 0, largeTotal: 0, largeCorrect: 0 })

  const smallPct = sizeStats.smallTotal > 0 ? (sizeStats.smallCorrect / sizeStats.smallTotal) : null
  const largePct = sizeStats.largeTotal > 0 ? (sizeStats.largeCorrect / sizeStats.largeTotal) : null

  const formatPct = (v: number | null | undefined) =>
    v != null ? `${Math.round(v * 100)}%` : '—'

  return (
    <div className="space-y-5">

      {/* ── Combined stats cards ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* ROI Detector */}
        <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <h3 className="text-sm font-semibold text-white">ROI Detector</h3>
            <span className="text-xs text-muted-foreground">
              {summary?.model_metadata?.roi_detector ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Detection Acc"
              value={formatPct(roiStats.accuracy)}
              sub={`${roiStats.correct ?? 0}/${roiStats.total ?? 0} correct`}
              color={
                (roiStats.accuracy ?? 0) >= 0.8 ? 'text-green-400'
                : (roiStats.accuracy ?? 0) >= 0.6 ? 'text-yellow-400'
                : 'text-red-400'
              }
            />
            <StatCard
              label="Avg IoU"
              value={roiStats.avgIou != null ? roiStats.avgIou.toFixed(2) : '—'}
              sub="threshold: 0.5"
              color={iouColor(roiStats.avgIou ?? null)}
            />
            <StatCard
              label="Avg Time"
              value={roiStats.avgMs != null ? `${roiStats.avgMs}ms` : '—'}
              sub={roiStats.regressions ? `${roiStats.regressions} regression${roiStats.regressions > 1 ? 's' : ''}` : 'No regressions'}
              color={roiStats.regressions ? 'text-red-400' : 'text-green-400'}
            />
          </div>
        </div>

        {/* Feature Classifier */}
        <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <h3 className="text-sm font-semibold text-white">Feature Classifier</h3>
            <span className="text-xs text-muted-foreground">
              {summary?.model_metadata?.feature_classifier ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="TI-RADS Acc"
              value={formatPct(xceptionStats.accuracy)}
              sub={`${xceptionStats.correct ?? 0}/${xceptionStats.total ?? 0} correct`}
              color={
                (xceptionStats.accuracy ?? 0) >= 0.8 ? 'text-green-400'
                : (xceptionStats.accuracy ?? 0) >= 0.6 ? 'text-yellow-400'
                : 'text-red-400'
              }
            />
            <StatCard
              label="Avg Time"
              value={xceptionStats.avgMs != null ? `${xceptionStats.avgMs}ms` : '—'}
            />
            <StatCard
              label="Regressions"
              value={String(xceptionStats.regressions ?? 0)}
              sub={`${xceptionStats.improvements ?? 0} improved`}
              color={xceptionStats.regressions ? 'text-red-400' : 'text-green-400'}
            />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-[#1e2736] pb-0">
        {(['roi', 'xception'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer
                        border-b-2 -mb-px
                        ${activeTab === tab
                          ? 'border-white text-white'
                          : 'border-transparent text-muted-foreground hover:text-white'
                        }`}
          >
            {tab === 'roi' ? '🟡 ROI Detector' : '🟣 Feature Classifier'}
          </button>
        ))}
      </div>

      {/* ── ROI Detector tab ── */}
      {activeTab === 'roi' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Analysis Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <IoUDistributionChart results={results} />
            <ConfidenceIoUScatter results={results} />
          </div>

          {/* Size-based and Thresholds Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5" />
                Nodule Size Sensitivity
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-[#1e2736]/30 p-2.5 rounded-lg border border-[#ffffff08]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Minimize2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-white">Small Nodules</p>
                      <p className="text-[9px] text-muted-foreground">&lt; 3000 px²</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${smallPct != null && smallPct >= 0.8 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {formatPct(smallPct)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-[#1e2736]/30 p-2.5 rounded-lg border border-[#ffffff08]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                      <Maximize2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-white">Large Nodules</p>
                      <p className="text-[9px] text-muted-foreground">&gt; 3000 px²</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${largePct != null && largePct >= 0.8 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {formatPct(largePct)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#0f1623] border border-[#1e2736] rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
               Precision @ IoU Thresholds
              </h4>
              <div className="space-y-3">
                {/* Standard Thresholds Row */}
                <div className="grid grid-cols-3 gap-2">
                  {[0.5, 0.6, 0.7].map(t => {
                    const count = results.filter(r => (r.iou_score ?? 0) >= t).length
                    const pct = count / results.length
                    return (
                      <div key={t} className="bg-[#1e2736]/20 py-2.5 px-1 rounded-lg border border-[#ffffff05] text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">@{t}</p>
                        <p className={`text-base font-bold ${pct >= 0.8 ? 'text-green-400' : pct >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {formatPct(pct)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* High-Precision Thresholds Row */}
                <div className="grid grid-cols-3 gap-2">
                  {[0.75, 0.8, 0.9].map(t => {
                    const count = results.filter(r => (r.iou_score ?? 0) >= t).length
                    const pct = count / results.length
                    return (
                      <div key={t} className="bg-[#1e2736]/20 py-2.5 px-1 rounded-lg border border-[#ffffff05] text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">@{t}</p>
                        <p className={`text-base font-bold ${pct >= 0.8 ? 'text-green-400' : pct >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {formatPct(pct)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic px-1 pt-2 border-t border-[#ffffff05]">
                Note: Standard detection uses @0.5 threshold. 0.9 represents near-perfect alignment.
              </p>
            </div>
          </div>

          {/* Worst Results Gallery */}
          <WorstResultsGallery results={results} />

          {/* Per-image table */}
          <div className="overflow-x-auto">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Individual Detection Logs
            </h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2736]">
                  {['#', 'Image', 'GT BBox', 'Pred BBox', 'IoU', 'Correct', 'Confidence', 'Time', 'Change'].map(h => (
                    <th key={h}
                      className="text-left text-[11px] text-muted-foreground
                                  uppercase tracking-wider py-2 px-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.result_id}
                    className={`border-b border-[#1e2736]/50 hover:bg-[#1e2736]/30
                                 transition-colors
                                 ${row.bbox_is_regression ? 'bg-red-500/5' : ''}
                                 ${row.bbox_is_improvement ? 'bg-green-500/5' : ''}`}>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">
                      {row.image_index}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-white max-w-[120px] truncate">
                      {row.image_description || `Image ${row.image_index}`}
                    </td>
                    {/* GT BBox */}
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                      {row.ground_truth_bbox
                        ? `${Math.round(row.ground_truth_bbox.x)},${Math.round(row.ground_truth_bbox.y)} ${Math.round(row.ground_truth_bbox.width)}×${Math.round(row.ground_truth_bbox.height)}`
                        : '—'
                      }
                    </td>
                    {/* Pred BBox */}
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                      {row.predicted_bbox
                        ? `${Math.round(row.predicted_bbox.x)},${Math.round(row.predicted_bbox.y)} ${Math.round(row.predicted_bbox.width)}×${Math.round(row.predicted_bbox.height)}`
                        : '—'
                      }
                    </td>
                    {/* IoU */}
                    <td className={`py-2.5 px-3 text-xs font-mono font-medium
                                     ${iouColor(row.iou_score)}`}>
                      {row.iou_score != null ? row.iou_score.toFixed(3) : '—'}
                    </td>
                    {/* Correct */}
                    <td className="py-2.5 px-3">
                      {row.bbox_correct === null ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : row.bbox_correct ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    {/* Confidence */}
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                      {row.roi_confidence != null
                        ? `${Math.round(row.roi_confidence * 100)}%`
                        : '—'
                      }
                    </td>
                    {/* Time */}
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                      {row.roi_inference_time_ms != null
                        ? `${row.roi_inference_time_ms}ms`
                        : '—'
                      }
                    </td>
                    {/* Change */}
                    <td className="py-2.5 px-3">
                      <RegressionBadge
                        isRegression={row.bbox_is_regression ?? null}
                        isImprovement={row.bbox_is_improvement ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Feature Classifier tab ── */}
      {activeTab === 'xception' && (
        <div className="space-y-8">
          {/* Top Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TiradsDistributionChart results={results} />
            <FeaturePerformanceRadar summary={summary} />
          </div>

          {/* Failure Gallery */}
          <ClassifierFailureGallery results={results} />

          {/* Detailed Logs Table */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Detailed Classification Logs
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2736]">
                    {['#', 'Image', 'GT', 'Pred', 'Δ', 'Features', 'Time', 'Change'].map(h => (
                      <th key={h}
                        className="text-left text-[11px] text-muted-foreground
                                    uppercase tracking-wider py-2 px-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map(row => (
                    <tr key={row.result_id}
                      className={`border-b border-[#1e2736]/50 hover:bg-[#1e2736]/30
                                   transition-colors
                                   ${row.tirads_is_regression ? 'bg-red-500/5' : ''}
                                   ${row.tirads_is_improvement ? 'bg-green-500/5' : ''}`}>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">
                        {row.image_index}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-white max-w-[120px] truncate">
                        {row.image_description || `Image ${row.image_index}`}
                      </td>
                      <td className={`py-2.5 px-3 text-xs font-bold
                                       ${tiradsColor(row.ground_truth_tirads)}`}>
                        TR{row.ground_truth_tirads ?? '?'}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-bold">
                        <span className={`${tiradsColor(row.predicted_tirads)}
                                          ${!row.tirads_correct ? 'underline decoration-red-400' : ''}`}>
                          TR{row.predicted_tirads ?? '?'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono">
                        {row.tirads_delta != null ? (
                          <span className={
                            row.tirads_delta === 0 ? 'text-green-400'
                            : Math.abs(row.tirads_delta) === 1 ? 'text-yellow-400'
                            : 'text-red-400'
                          }>
                            {row.tirads_delta > 0 ? '+' : ''}{row.tirads_delta}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <FeatureAccuracyPills accuracy={row.feature_accuracy} />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                        {row.xception_inference_time_ms != null
                          ? `${row.xception_inference_time_ms}ms`
                          : '—'
                        }
                      </td>
                      <td className="py-2.5 px-3">
                        <RegressionBadge
                          isRegression={row.tirads_is_regression ?? null}
                          isImprovement={row.tirads_is_improvement ?? null}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confusion Matrix Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                TI-RADS Confusion Matrix
              </h4>
              <ConfusionMatrix matrix={xceptionStats.confusion ?? null} />
            </div>
            
            {/* Feature Breakdown moved here for space efficiency */}
            {xceptionStats.features && (
              <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Feature Accuracy
                </h4>
                <div className="space-y-3">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                    const acc = xceptionStats.features?.[key] ?? 0
                    const pct = Math.round(acc * 100)
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'}>{pct}%</span>
                        </div>
                        <div className="h-1 bg-[#1e2736] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all
                                         ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
