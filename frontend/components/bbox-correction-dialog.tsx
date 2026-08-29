// components/bbox-correction-dialog.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  MapPin,
  Sparkles,
  Maximize2,
  Info,
} from "lucide-react";
import { BBoxData } from "@/components/admin/curation/annotation/types";

interface BBoxCorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  aiBbox?: BBoxData | null;
  initialBbox?: BBoxData | null;
  onSave: (bbox: BBoxData) => void;
}

interface Point {
  x: number;
  y: number;
}

export default function BBoxCorrectionDialog({
  isOpen,
  onClose,
  imageUrl,
  aiBbox,
  initialBbox,
  onSave,
}: BBoxCorrectionDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showAiBbox, setShowAiBbox] = useState(true);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentDrawnBox, setCurrentDrawnBox] = useState<BBoxData | null>(
    initialBbox || null,
  );

  // Canvas size state
  const [canvasDim, setCanvasDim] = useState({ width: 640, height: 440 });

  // Sync initial box when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentDrawnBox(initialBbox || null);
    }
  }, [isOpen, initialBbox]);

  // ── Load Image ───────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl || !isOpen) return;

    setImageLoaded(false);
    setImageError(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };

    img.onerror = () => {
      setImageError("Failed to load ultrasound scan image");
    };

    return () => {
      imageRef.current = null;
    };
  }, [imageUrl, isOpen]);

  // ── Auto-size Canvas on container resize ─────────────────
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updateSize = () => {
      if (!containerRef.current || !imageRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width || 640;
      const maxH = 460;

      const imgW = imageRef.current.naturalWidth || 640;
      const imgH = imageRef.current.naturalHeight || 480;
      const aspect = imgW / imgH;

      let targetW = containerW;
      let targetH = containerW / aspect;

      if (targetH > maxH) {
        targetH = maxH;
        targetW = maxH * aspect;
      }

      setCanvasDim({
        width: Math.round(targetW),
        height: Math.round(targetH),
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isOpen, imageLoaded]);

  // ── Coordinate Conversions ───────────────────────────────
  const canvasToImage = useCallback(
    (canvasX: number, canvasY: number): Point => {
      if (!imageRef.current) return { x: canvasX, y: canvasY };
      const natW = imageRef.current.naturalWidth;
      const natH = imageRef.current.naturalHeight;
      const scaleX = natW / canvasDim.width;
      const scaleY = natH / canvasDim.height;
      return {
        x: Math.max(0, Math.min(natW, canvasX * scaleX)),
        y: Math.max(0, Math.min(natH, canvasY * scaleY)),
      };
    },
    [canvasDim],
  );

  const imageToCanvas = useCallback(
    (imgX: number, imgY: number): Point => {
      if (!imageRef.current) return { x: imgX, y: imgY };
      const natW = imageRef.current.naturalWidth || 1;
      const natH = imageRef.current.naturalHeight || 1;
      const scaleX = canvasDim.width / natW;
      const scaleY = canvasDim.height / natH;
      return {
        x: imgX * scaleX,
        y: imgY * scaleY,
      };
    },
    [canvasDim],
  );

  // ── Redraw Canvas ────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasDim;
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    // Draw ultrasound image
    if (imageRef.current && imageLoaded) {
      ctx.drawImage(imageRef.current, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        imageError ? `⚠️ ${imageError}` : "Loading scan image...",
        width / 2,
        height / 2,
      );
      return;
    }

    const natW = imageRef.current.naturalWidth;
    const natH = imageRef.current.naturalHeight;
    const scaleX = width / natW;
    const scaleY = height / natH;

    // 1. Draw AI Bounding Box (if enabled)
    if (showAiBbox && aiBbox && aiBbox.width > 0 && aiBbox.height > 0) {
      const ax = (aiBbox.x || 0) * scaleX;
      const ay = (aiBbox.y || 0) * scaleY;
      const aw = (aiBbox.width || 0) * scaleX;
      const ah = (aiBbox.height || 0) * scaleY;

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#f43f5e"; // Rose-500
      ctx.lineWidth = 2;
      ctx.strokeRect(ax, ay, aw, ah);

      ctx.fillStyle = "rgba(244, 63, 94, 0.08)";
      ctx.fillRect(ax, ay, aw, ah);

      // AI Tag Label
      ctx.fillStyle = "#f43f5e";
      ctx.font = "bold 10px sans-serif";
      const tagText = "AI Detection";
      const tagW = ctx.measureText(tagText).width + 8;
      ctx.fillRect(ax, Math.max(0, ay - 16), tagW, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tagText, ax + 4, Math.max(12, ay - 4));
      ctx.restore();
    }

    // 2. Draw Doctor's Corrected Box
    if (currentDrawnBox && currentDrawnBox.width > 0 && currentDrawnBox.height > 0) {
      const dx = currentDrawnBox.x * scaleX;
      const dy = currentDrawnBox.y * scaleY;
      const dw = currentDrawnBox.width * scaleX;
      const dh = currentDrawnBox.height * scaleY;

      ctx.save();
      ctx.strokeStyle = "#10b981"; // Emerald-500
      ctx.lineWidth = 2.5;
      ctx.strokeRect(dx, dy, dw, dh);

      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(dx, dy, dw, dh);

      // Corner accent markers
      const handleSize = 6;
      ctx.fillStyle = "#34d399";
      ctx.fillRect(dx - handleSize / 2, dy - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(dx + dw - handleSize / 2, dy - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(dx - handleSize / 2, dy + dh - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(dx + dw - handleSize / 2, dy + dh - handleSize / 2, handleSize, handleSize);

      // Doctor Correction Tag
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 10px sans-serif";
      const tagText = `Doctor Correction (${Math.round(currentDrawnBox.width)}×${Math.round(currentDrawnBox.height)}px)`;
      const tagW = ctx.measureText(tagText).width + 8;
      const labelY = dy + dh + 18 <= height ? dy + dh + 4 : dy - 18;
      ctx.fillRect(dx, labelY, tagW, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tagText, dx + 4, labelY + 12);
      ctx.restore();
    }
  }, [canvasDim, imageLoaded, imageError, showAiBbox, aiBbox, currentDrawnBox]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ── Mouse & Touch Event Handlers ─────────────────────────
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    const pt = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(pt);

    const imgPt = canvasToImage(pt.x, pt.y);
    if (!imageRef.current) return;

    setCurrentDrawnBox({
      x: imgPt.x,
      y: imgPt.y,
      width: 0,
      height: 0,
      format: "xywh",
      image_width: imageRef.current.naturalWidth,
      image_height: imageRef.current.naturalHeight,
      coordinate_space: "raw_image",
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !imageRef.current) return;
    const currentPt = getCanvasCoordinates(e);

    const p1 = canvasToImage(startPoint.x, startPoint.y);
    const p2 = canvasToImage(currentPt.x, currentPt.y);

    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const width = Math.abs(p2.x - p1.x);
    const height = Math.abs(p2.y - p1.y);

    setCurrentDrawnBox({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      format: "xywh",
      image_width: imageRef.current.naturalWidth,
      image_height: imageRef.current.naturalHeight,
      coordinate_space: "raw_image",
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPoint(null);

    // If box is too small (accidental click), discard
    if (
      currentDrawnBox &&
      (currentDrawnBox.width < 5 || currentDrawnBox.height < 5)
    ) {
      setCurrentDrawnBox(null);
    }
  };

  const handleClear = () => {
    setCurrentDrawnBox(null);
  };

  const handleConfirm = () => {
    if (currentDrawnBox && currentDrawnBox.width >= 5 && currentDrawnBox.height >= 5) {
      onSave(currentDrawnBox);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl border-border bg-card p-5 shadow-2xl rounded-2xl sm:max-w-3xl"
        showCloseButton={true}
      >
        <DialogHeader className="gap-1 text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Draw Corrected Nodule Location
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Click and drag on the ultrasound scan to define the accurate nodule boundary.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
          <div className="flex items-center gap-2">
            {aiBbox && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiBbox(!showAiBbox)}
                className={`h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  showAiBbox
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {showAiBbox ? (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    AI Box (Visible)
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                    AI Box (Hidden)
                  </>
                )}
              </Button>
            )}

            {currentDrawnBox && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Clear Box
              </Button>
            )}
          </div>

          {/* Coordinates HUD */}
          {currentDrawnBox && currentDrawnBox.width > 0 ? (
            <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
              <span>X: {Math.round(currentDrawnBox.x)}</span>
              <span>Y: {Math.round(currentDrawnBox.y)}</span>
              <span>W: {Math.round(currentDrawnBox.width)}</span>
              <span>H: {Math.round(currentDrawnBox.height)}</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              Drag cursor over scan to draw
            </span>
          )}
        </div>

        {/* ── Canvas Container ── */}
        <div
          ref={containerRef}
          className="relative w-full rounded-xl overflow-hidden border border-border/80 bg-black flex items-center justify-center select-none shadow-inner"
          style={{ minHeight: "360px" }}
        >
          <canvas
            ref={canvasRef}
            width={canvasDim.width}
            height={canvasDim.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair block max-w-full touch-none"
          />
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!currentDrawnBox || currentDrawnBox.width < 5 || currentDrawnBox.height < 5}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Apply Corrected Box
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
