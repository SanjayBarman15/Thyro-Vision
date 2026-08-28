// components/admin/benchmark/ClassifierFailureGallery.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { BenchmarkResult, tiradsColor, FEATURE_LABELS, BBoxData, GradCamData } from './types'
import { TrendingDown, Eye, Info, Box } from 'lucide-react'

// ── Jet colormap (Blue→Cyan→Green→Yellow→Red) ───────────────────────────────
const JET_LUT: [number, number, number][] = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3)));
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2)));
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
});

function drawHeatmap(
  canvas: HTMLCanvasElement,
  imageEl: HTMLImageElement,
  boundingBox: BBoxData,
  heatmap: number[][],
  opacity: number,
) {
  const rows = heatmap.length;
  const cols = heatmap[0]?.length ?? 0;
  if (!rows || !cols) return;

  const dispW = imageEl.clientWidth;
  const dispH = imageEl.clientHeight;
  const natW = imageEl.naturalWidth  || boundingBox.image_width || 640;
  const natH = imageEl.naturalHeight || boundingBox.image_height || 480;

  const scaleX = dispW / natW;
  const scaleY = dispH / natH;

  // Prefer VOC format if available, else use x/y/w/h
  const bx = (boundingBox.xmin ?? boundingBox.x) * scaleX;
  const by = (boundingBox.ymin ?? boundingBox.y) * scaleY;
  const bw = (boundingBox.width ?? ((boundingBox.xmax ?? 0) - (boundingBox.xmin ?? 0))) * scaleX;
  const bh = (boundingBox.height ?? ((boundingBox.ymax ?? 0) - (boundingBox.ymin ?? 0))) * scaleY;

  canvas.width  = dispW;
  canvas.height = dispH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const offscreen = document.createElement("canvas");
  offscreen.width  = cols;
  offscreen.height = rows;
  const octx = offscreen.getContext("2d")!;
  const imgData = octx.createImageData(cols, rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = Math.max(0, Math.min(1, heatmap[r][c]));
      const [red, green, blue] = JET_LUT[Math.round(val * 255)];
      const idx = (r * cols + c) * 4;
      imgData.data[idx]     = red;
      imgData.data[idx + 1] = green;
      imgData.data[idx + 2] = blue;
      imgData.data[idx + 3] = Math.round((0.08 + val * 0.92) * opacity * 255);
    }
  }
  octx.putImageData(imgData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, bx, by, bw, bh);
}

interface CardProps {
  result: BenchmarkResult
  showBBox: boolean
  showGradCAM: boolean
}

function FailureCard({ result, showBBox, showGradCAM }: CardProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const imgData = Array.isArray(result.benchmark_images) 
    ? result.benchmark_images[0] 
    : result.benchmark_images

  const bbox = result.ground_truth_bbox
  const gradCamData = (result.predicted_features as any)?.grad_cam_data as GradCamData | undefined

  const redraw = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !gradCamData?.heatmap || !result.ground_truth_bbox) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    if (showGradCAM && gradCamData.gradcam_available) {
      drawHeatmap(canvasRef.current, imgRef.current, result.ground_truth_bbox, gradCamData.heatmap, 0.75)
    } else {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [showGradCAM, gradCamData, result.ground_truth_bbox])

  useEffect(() => {
    redraw()
    const ro = new ResizeObserver(redraw)
    if (imgRef.current) ro.observe(imgRef.current)
    return () => ro.disconnect()
  }, [redraw])

  return (
    <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl overflow-hidden shadow-lg flex flex-col group">
      {/* Image container */}
      <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center p-2">
        <div 
          className="relative max-w-full max-h-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-[#0a0f18]"
          style={{ aspectRatio: `${bbox?.image_width || 640} / ${bbox?.image_height || 480}` }}
        >
          {imgData?.file_url ? (
            <img 
              ref={imgRef}
              src={imgData.file_url} 
              alt={result.image_description}
              className={`block w-full h-full object-fill transition-opacity duration-300 ${showGradCAM ? 'opacity-60' : 'opacity-80'}`}
              onLoad={redraw}
            />
          ) : (
            <div className="text-xs text-muted-foreground p-4">Image missing</div>
          )}
          
          {/* Grad-CAM Canvas Overlay */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          />

          {/* BBox Overlay */}
          {showBBox && bbox && (
            <div 
              className="absolute border-2 border-green-500/60 transition-all z-20 pointer-events-none"
              style={{
                left:   `${((bbox.xmin ?? bbox.x) / (bbox.image_width  || 640)) * 100}%`,
                top:    `${((bbox.ymin ?? bbox.y) / (bbox.image_height || 480)) * 100}%`,
                width:  `${((bbox.width ?? ((bbox.xmax ?? 0) - (bbox.xmin ?? 0)))  / (bbox.image_width  || 640)) * 100}%`,
                height: `${((bbox.height ?? ((bbox.ymax ?? 0) - (bbox.ymin ?? 0))) / (bbox.image_height || 480)) * 100}%`
              }}
            >
              <div className="absolute -top-4 left-0 text-[8px] bg-green-500 text-white px-1 font-bold rounded-t">
                GT ROI
              </div>
            </div>
          )}
        </div>

        {/* Delta Badge (Always absolute to the outermost 16:9 container) */}
        <div className="absolute top-2 right-2 bg-red-500/20 backdrop-blur-md border border-red-500/30 px-2 py-1 rounded text-[10px] font-mono font-bold text-red-400 z-30">
          Δ: {(result.tirads_delta ?? 0) > 0 ? '+' : ''}{result.tirads_delta ?? 0}
        </div>
      </div>

      <div className="p-3 space-y-3 flex-1">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-white truncate max-w-[140px]">
              {result.image_description || `Image ${result.image_index}`}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">Idx: {result.image_index}</p>
          </div>
          <div className="flex gap-2 text-center text-[9px]">
            <div className="px-2 py-1 bg-[#1e2736] rounded">
              <p className="text-muted-foreground uppercase opacity-60">Truth</p>
              <p className={`font-bold ${tiradsColor(result.ground_truth_tirads)}`}>TR{result.ground_truth_tirads}</p>
            </div>
            <div className="px-2 py-1 bg-[#1e2736] rounded border border-red-500/20">
              <p className="text-muted-foreground uppercase opacity-60">Pred</p>
              <p className={`font-bold ${tiradsColor(result.predicted_tirads)}`}>TR{result.predicted_tirads}</p>
            </div>
          </div>
        </div>

        {/* Failed Features */}
        <div className="space-y-1.5 pt-2 border-t border-[#1e2736]">
          <p className="text-[9px] text-muted-foreground uppercase font-semibold">Failed Features:</p>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const correct = result.feature_accuracy?.[key]
              if (correct === true) return null
              return (
                <span key={key} className="text-[8px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded uppercase">
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  results: BenchmarkResult[]
}

export default function ClassifierFailureGallery({ results }: Props) {
  const [showBBox, setShowBBox] = useState(false)
  const [showGradCAM, setShowGradCAM] = useState(false)

  const worst = [...results]
    .filter(r => r.tirads_delta !== null)
    .sort((a, b) => Math.abs(b.tirads_delta ?? 0) - Math.abs(a.tirads_delta ?? 0))
    .filter(r => Math.abs(r.tirads_delta ?? 0) >= 1)
    .slice(0, 3)

  if (worst.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Classification Failure Highlights (Highest Δ)
          </h4>
        </div>

        {/* Diagnostic Toggles */}
        <div className="flex items-center gap-2 bg-[#0f1623] border border-[#1e2736] p-1 rounded-lg">
          <button
            onClick={() => setShowBBox(!showBBox)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showBBox ? 'bg-green-500/20 text-green-400' : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Box className="w-3 h-3" />
            BBox
          </button>
          <button
            onClick={() => setShowGradCAM(!showGradCAM)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showGradCAM ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            Grad-CAM
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {worst.map((r) => (
          <FailureCard 
            key={r.result_id} 
            result={r} 
            showBBox={showBBox} 
            showGradCAM={showGradCAM} 
          />
        ))}
      </div>
      
      {(showBBox || showGradCAM) && (
        <p className="text-[9px] text-muted-foreground italic flex items-center gap-1.5 pl-1">
          <Info className="w-3 h-3" />
          {showGradCAM && "Grad-CAM heatmaps highlight regions the model 'focused' on. "}
          {showBBox && "ROI box shows the ground truth location evaluated by the classifier."}
        </p>
      )}
    </div>
  )
}
