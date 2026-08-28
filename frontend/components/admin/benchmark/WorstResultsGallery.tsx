// components/admin/benchmark/WorstResultsGallery.tsx
'use client'

import { BenchmarkResult, iouColor } from './types'
import { AlertCircle } from 'lucide-react'

interface Props {
  results: BenchmarkResult[]
}

export default function WorstResultsGallery({ results }: Props) {
  // ── Get top 3 worst IoU results ────────────────────────
  const worst = [...results]
    .filter(r => r.iou_score !== null)
    .sort((a, b) => (a.iou_score ?? 0) - (b.iou_score ?? 0))
    .slice(0, 3)

  if (worst.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          ROI Failure Analysis (Lowest IoU)
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {worst.map((r) => (
          <div key={r.result_id} className="bg-[#0f1623] border border-[#1e2736] rounded-xl overflow-hidden shadow-lg">
            {/* Image container with relative positioning for BBox overlay */}
            <div className="relative aspect-square bg-black overflow-hidden flex items-center justify-center p-2">
              {(() => {
                const imgData = Array.isArray(r.benchmark_images) 
                  ? r.benchmark_images[0] 
                  : r.benchmark_images
                
                if (!imgData?.file_url) return (
                  <div className="text-xs text-muted-foreground p-4">Image missing</div>
                )

                // Use original image dimensions for percentage scaling
                const w = r.ground_truth_bbox?.image_width || r.predicted_bbox?.image_width || 640
                const h = r.ground_truth_bbox?.image_height || r.predicted_bbox?.image_height || 480

                return (
                  <div 
                    className="relative max-w-full max-h-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-[#0a0f18]"
                    style={{ aspectRatio: `${w} / ${h}` }}
                  >
                    <img 
                      src={imgData.file_url} 
                      alt={r.image_description}
                      className="block w-full h-full object-fill opacity-80"
                    />
                    
                    {/* GT BBox (Green) */}
                    {r.ground_truth_bbox && (
                      <div 
                        className="absolute border-2 border-green-500/60 transition-all z-20 pointer-events-none"
                        style={{
                          left: `${((r.ground_truth_bbox.xmin ?? r.ground_truth_bbox.x) / w) * 100}%`,
                          top: `${((r.ground_truth_bbox.ymin ?? r.ground_truth_bbox.y) / h) * 100}%`,
                          width: `${((r.ground_truth_bbox.width ?? ((r.ground_truth_bbox.xmax ?? 0) - (r.ground_truth_bbox.xmin ?? 0))) / w) * 100}%`,
                          height: `${((r.ground_truth_bbox.height ?? ((r.ground_truth_bbox.ymax ?? 0) - (r.ground_truth_bbox.ymin ?? 0))) / h) * 100}%`,
                        }}
                      >
                        <span className="absolute -top-4 left-0 text-[8px] bg-green-500 text-white px-1 rounded-sm uppercase font-bold">GT</span>
                      </div>
                    )}

                    {/* Predicted BBox (Red) */}
                    {r.predicted_bbox && (
                      <div 
                        className="absolute border-2 border-red-500/60 transition-all z-20 pointer-events-none"
                        style={{
                          left: `${((r.predicted_bbox.xmin ?? r.predicted_bbox.x) / w) * 100}%`,
                          top: `${((r.predicted_bbox.ymin ?? r.predicted_bbox.y) / h) * 100}%`,
                          width: `${((r.predicted_bbox.width ?? ((r.predicted_bbox.xmax ?? 0) - (r.predicted_bbox.xmin ?? 0))) / w) * 100}%`,
                          height: `${((r.predicted_bbox.height ?? ((r.predicted_bbox.ymax ?? 0) - (r.predicted_bbox.ymin ?? 0))) / h) * 100}%`,
                        }}
                      >
                        <span className="absolute -bottom-4 right-0 text-[8px] bg-red-500 text-white px-1 rounded-sm uppercase font-bold">Pred</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* IoU Badge Overlay */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md border border-[#ffffff10] px-2 py-1 rounded text-[10px] font-mono font-bold">
                IoU: <span className={iouColor(r.iou_score)}>{r.iou_score?.toFixed(3)}</span>
              </div>
            </div>

            <div className="p-3 space-y-1">
              <p className="text-[11px] font-medium text-white truncate">
                {r.image_description || `Image ${r.image_index}`}
              </p>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                <span>Idx: {r.image_index}</span>
                <span>Conf: {Math.round((r.roi_confidence ?? 0) * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-4 py-1 text-[10px] text-muted-foreground font-medium italic">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-500 rounded-full shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
          <span>Green = Ground Truth</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500 rounded-full shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
          <span>Red = Model Prediction</span>
        </div>
      </div>
    </div>
  )
}
