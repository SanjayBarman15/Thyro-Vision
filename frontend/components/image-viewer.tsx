// components/image-viewer.tsx
"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { imageViewerColors } from "@/lib/colors";

// ─── Jet colormap (Blue→Cyan→Green→Yellow→Red) ───────────────────────────────
const JET_LUT: [number, number, number][] = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3)));
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2)));
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  image_width: number;
  image_height: number;
  format?: string;
  coordinate_space?: string;
}

interface GradCamData {
  heatmap: number[][];
  heatmap_shape: [number, number];
  gradcam_available: boolean;
  target_class?: string;
  target_layer?: string;
  top_features?: string[];
  color_mapping?: { colormap: string; min_value: number; max_value: number };
}

interface ImageViewerProps {
  zoomLevel: number;
  imageMode: "original" | "processed" | "gradcam";
  imageUrl?: string;
  boundingBox?: BoundingBox;
  gradCamData?: GradCamData;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onModeChange: (mode: "original" | "processed" | "gradcam") => void;
  onZoomScale?: (delta: number) => void;
}

// ─── Heatmap renderer ─────────────────────────────────────────────────────────
// Renders the 10×10 heatmap onto a canvas sized to the bounding box region,
// then draws it at the correct position over the full image.
function drawHeatmap(
  canvas: HTMLCanvasElement,
  imageEl: HTMLImageElement,
  boundingBox: BoundingBox,
  heatmap: number[][],
  opacity: number,
) {
  const rows = heatmap.length;
  const cols = heatmap[0]?.length ?? 0;
  if (!rows || !cols) return;

  // Displayed image dimensions (may differ from natural size due to CSS)
  const dispW = imageEl.clientWidth;
  const dispH = imageEl.clientHeight;

  // Natural image dimensions (what bounding box coords are relative to)
  const natW = imageEl.naturalWidth  || boundingBox.image_width;
  const natH = imageEl.naturalHeight || boundingBox.image_height;

  // Scale factors from natural → displayed
  const scaleX = dispW / natW;
  const scaleY = dispH / natH;

  // Bounding box in displayed image coordinates
  const bx = boundingBox.x      * scaleX;
  const by = boundingBox.y      * scaleY;
  const bw = boundingBox.width  * scaleX;
  const bh = boundingBox.height * scaleY;

  // Size canvas to match displayed image
  canvas.width  = dispW;
  canvas.height = dispH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Step 1: Build native-resolution heatmap (cols×rows pixels) ──────────
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
      // Alpha: low-activation areas are near-transparent, high areas are opaque
      // This lets the anatomy show through in non-suspicious regions
      imgData.data[idx + 3] = Math.round((0.08 + val * 0.92) * opacity * 255);
    }
  }
  octx.putImageData(imgData, 0, 0);

  // ── Step 2: Stretch heatmap to bounding box size with smooth interpolation ──
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, bx, by, bw, bh);
}

// ─── ColorBar legend ─────────────────────────────────────────────────────────
function ColorBar() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    for (let x = 0; x < canvas.width; x++) {
      const [r, g, b] = JET_LUT[Math.round((x / canvas.width) * 255)];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, canvas.height);
    }
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-zinc-500 font-mono">Low</span>
      <canvas ref={ref} width={80} height={6} className="rounded-sm" />
      <span className="text-[9px] text-zinc-500 font-mono">High</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ImageViewer({
  zoomLevel,
  imageMode,
  imageUrl,
  boundingBox,
  gradCamData,
  onZoomIn,
  onZoomOut,
  onReset,
  onModeChange,
  onZoomScale,
}: ImageViewerProps) {
  const [isLoading, setIsLoading]   = useState(true);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.72);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef     = useRef<HTMLImageElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  // Pan state
  const [position, setPosition]       = useState({ x: 0, y: 0 });
  const isDragging                     = useRef(false);
  const dragStart                      = useRef({ x: 0, y: 0 });
  const lastPosition                   = useRef({ x: 0, y: 0 });

  const gradcamAvailable =
    gradCamData?.gradcam_available &&
    Array.isArray(gradCamData?.heatmap) &&
    gradCamData.heatmap.length > 0;

  // Reset loading when image changes
  useEffect(() => {
    if (imageUrl) setIsLoading(true);
  }, [imageUrl]);

  // Position constraints on zoom change
  useEffect(() => {
    if (zoomLevel <= 1) {
      setPosition({ x: 0, y: 0 });
      lastPosition.current = { x: 0, y: 0 };
    } else if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const maxX = (width  * (zoomLevel - 1)) / 2;
      const maxY = (height * (zoomLevel - 1)) / 2;
      const cx = Math.max(-maxX, Math.min(position.x, maxX));
      const cy = Math.max(-maxY, Math.min(position.y, maxY));
      if (cx !== position.x || cy !== position.y) {
        setPosition({ x: cx, y: cy });
        lastPosition.current = { x: cx, y: cy };
      }
    }
  }, [zoomLevel]);

  // ── Draw / redraw heatmap canvas whenever relevant state changes ──────────
  const redrawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    const imgEl  = imageRef.current;
    if (!canvas || !imgEl || !boundingBox || !gradCamData?.heatmap) return;

    if (imageMode === "gradcam" && gradcamAvailable) {
      drawHeatmap(canvas, imgEl, boundingBox, gradCamData.heatmap, heatmapOpacity);
    } else {
      // Clear canvas when not in gradcam mode
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [imageMode, gradcamAvailable, gradCamData, boundingBox, heatmapOpacity]);

  // Redraw on mode change, opacity change, or image load
  useEffect(() => { redrawHeatmap(); }, [redrawHeatmap]);

  // Redraw on container resize (e.g. split-pane drag)
  useEffect(() => {
    const ro = new ResizeObserver(() => redrawHeatmap());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [redrawHeatmap]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, y: e.clientY };
    lastPosition.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const maxX = (width  * (zoomLevel - 1)) / 2;
    const maxY = (height * (zoomLevel - 1)) / 2;
    setPosition({
      x: Math.max(-maxX, Math.min(lastPosition.current.x + e.clientX - dragStart.current.x, maxX)),
      y: Math.max(-maxY, Math.min(lastPosition.current.y + e.clientY - dragStart.current.y, maxY)),
    });
  };

  const handleMouseUp = () => { isDragging.current = false; lastPosition.current = { ...position }; };

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (onZoomScale) onZoomScale(-e.deltaY * 0.009);
      else e.deltaY < 0 ? onZoomIn() : onZoomOut();
    };
    const onGesture = (e: Event) => e.preventDefault();
    container.addEventListener("wheel",        onWheel,   { passive: false, capture: true });
    container.addEventListener("gesturestart", onGesture, { passive: false });
    container.addEventListener("gesturechange",onGesture, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel, { capture: true } as any);
      container.removeEventListener("gesturestart",  onGesture);
      container.removeEventListener("gesturechange", onGesture);
    };
  }, [onZoomScale, onZoomIn, onZoomOut]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-black relative group overflow-hidden select-none touch-none"
      style={{ overscrollBehavior: "none" }}
    >
      {/* ── Viewport ── */}
      <div
        className={`flex-1 relative w-full h-full overflow-hidden outline-none ${
          zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transform layer */}
        <div
          className="absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
            transition: isDragging.current ? "none" : "transform 0.15s cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative border-2 border-white shadow-2xl bg-zinc-900 overflow-hidden"
              style={{
                aspectRatio:
                  boundingBox?.image_width && boundingBox?.image_height
                    ? `${boundingBox.image_width} / ${boundingBox.image_height}`
                    : "auto",
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              {/* ── Ultrasound image ── */}
              {imageUrl ? (
                <img
                  key={imageUrl}
                  ref={imageRef}
                  src={imageUrl}
                  alt="Ultrasound Scan"
                  className={`max-w-full max-h-full block ${
                    imageMode === "processed" ? "brightness-110 contrast-125" : ""
                  } ${imageMode === "gradcam" ? "brightness-75" : ""}`}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                    setIsLoading(false);
                    // Trigger heatmap draw after image is ready
                    setTimeout(redrawHeatmap, 50);
                  }}
                  onError={() => setIsLoading(false)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[120px] mb-4 blur-[1px] opacity-50 grayscale">📷</div>
                </div>
              )}

              {/* ── Grad-CAM canvas (sits directly over the image) ── */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none z-20"
                style={{ width: "100%", height: "100%" }}
              />

              {/* ── Bounding box (shown in processed + gradcam mode) ── */}
              {(imageMode === "processed" || imageMode === "gradcam") && boundingBox && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <div
                    className={`absolute border-2 ${imageViewerColors.boundingBox.border} ${
                      imageMode === "gradcam" ? "bg-transparent" : imageViewerColors.boundingBox.bg
                    } ${imageViewerColors.boundingBox.shadow} transition-all`}
                    style={{
                      left:   `${(boundingBox.x     / (naturalSize?.width  || boundingBox.image_width  || 1)) * 100}%`,
                      top:    `${(boundingBox.y     / (naturalSize?.height || boundingBox.image_height || 1)) * 100}%`,
                      width:  `${(boundingBox.width / (naturalSize?.width  || boundingBox.image_width  || 1)) * 100}%`,
                      height: `${(boundingBox.height/ (naturalSize?.height || boundingBox.image_height || 1)) * 100}%`,
                    }}
                  >
                    <div className={`absolute -top-6 left-0 ${imageViewerColors.boundingBox.labelBg} ${imageViewerColors.boundingBox.labelText} text-[10px] font-bold px-2 py-0.5 border ${imageViewerColors.boundingBox.labelBorder} rounded-sm whitespace-nowrap shadow-sm`}>
                      NODULE DETECTED
                    </div>
                  </div>
                </div>
              )}



              {/* ── GradCAM unavailable notice ── */}
              {imageMode === "gradcam" && !gradcamAvailable && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/80 border border-amber-500/30 rounded-lg px-4 py-3 text-center">
                    <p className="text-amber-400 text-xs font-mono">⚠ Grad-CAM unavailable</p>
                    <p className="text-zinc-500 text-[10px] mt-1">No heatmap data for this scan</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-white text-xs font-mono tracking-widest uppercase opacity-70">
                Loading scan...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── GradCAM legend — top-right of viewer panel (outside image) ── */}
      {imageMode === "gradcam" && gradcamAvailable && (
        <div className="absolute top-3 right-4 z-40 pointer-events-none">
          <div className="bg-black/80 border border-emerald-500/30 rounded-lg px-3 py-2.5 flex flex-col gap-2 shadow-xl shadow-black/40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                Grad-CAM Active
              </span>
            </div>
            <div className="h-px bg-white/5" />
            <ColorBar />
          </div>
        </div>
      )}

      {/* ── Opacity slider — bottom-right corner ── */}
      {imageMode === "gradcam" && gradcamAvailable && (
        <div className="absolute bottom-6 right-4 z-40 bg-black/80 border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-2 shadow-xl shadow-black/40 min-w-[160px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              Opacity
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              {Math.round(heatmapOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(heatmapOpacity * 100)}
            onChange={(e) => setHeatmapOpacity(Number(e.target.value) / 100)}
            className="w-full accent-emerald-500 cursor-pointer h-1"
          />
          <div className="flex justify-between">
            <span className="text-[9px] text-zinc-600 font-mono">20%</span>
            <span className="text-[9px] text-zinc-600 font-mono">100%</span>
          </div>
        </div>
      )}

      {/* ── Controls HUD (bottom center) ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black border border-white/10 p-1.5 rounded-full shadow-2xl z-30">

        {/* Mode switcher — now 3 buttons */}
        <div className="flex bg-white/5 rounded-full p-0.5 mr-2">
          <button
            onClick={() => onModeChange("original")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
              imageMode === "original"
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Raw
          </button>
          <button
            onClick={() => onModeChange("processed")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
              imageMode === "processed"
                ? imageViewerColors.modeButton.active
                : imageViewerColors.modeButton.inactive
            }`}
          >
            AI Analysis
          </button>
          <button
            onClick={() => onModeChange("gradcam")}
            disabled={!gradcamAvailable}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
              imageMode === "gradcam"
                ? "bg-emerald-600 text-white shadow-sm"
                : gradcamAvailable
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-zinc-700 cursor-not-allowed opacity-40"
            }`}
            title={!gradcamAvailable ? "Grad-CAM not available for this scan" : "Show Grad-CAM heatmap"}
          >
            Grad-CAM
          </button>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Zoom controls (unchanged) */}
        <Button
          variant="ghost" size="icon" onClick={onZoomOut}
          disabled={zoomLevel <= 0.5}
          className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono text-zinc-300 w-12 text-center select-none tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
        <Button
          variant="ghost" size="icon" onClick={onZoomIn}
          disabled={zoomLevel >= 4}
          className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <Button
          variant="ghost" size="icon" onClick={onReset}
          className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
          title="Reset View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}