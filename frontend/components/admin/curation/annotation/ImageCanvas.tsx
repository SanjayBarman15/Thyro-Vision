// components/admin/curation/annotation/ImageCanvas.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BBoxData } from './types'

interface Props {
  rawImageUrl: string | null
  gradcamUrl:  string | null
  aiBbox:      BBoxData | null
  currentBbox: BBoxData | null
  onChange:    (bbox: BBoxData | null) => void
}

interface DrawingState {
  isDrawing: boolean
  startX:    number
  startY:    number
}

interface PanState {
  x: number; y: number; panX: number; panY: number
}

// ── Toggle button ─────────────────────────────────────────
function ToggleButton({
  label, active, color, onClick,
}: {
  label: string; active: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border
                  transition-colors cursor-pointer
                  ${active
                    ? `${color} border-current bg-current/10`
                    : 'text-muted-foreground border-[#2d3748] hover:text-white'
                  }`}
    >
      {label}
    </button>
  )
}

export default function ImageCanvas({
  rawImageUrl, gradcamUrl, aiBbox, currentBbox, onChange,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef     = useRef<HTMLImageElement | null>(null)
  const gradcamRef   = useRef<HTMLImageElement | null>(null)
  const drawingRef   = useRef<DrawingState>({ isDrawing: false, startX: 0, startY: 0 })
  const panStartRef  = useRef<PanState>({ x: 0, y: 0, panX: 0, panY: 0 })

  const [showAiBbox,   setShowAiBbox]   = useState(true)
  const [showGradcam,  setShowGradcam]  = useState(false)
  const [showNewBbox,  setShowNewBbox]  = useState(true)
  const [isDrawMode,   setIsDrawMode]   = useState(false)
  const [isPanning,    setIsPanning]    = useState(false)
  const [canvasSize,   setCanvasSize]   = useState({ width: 600, height: 400 })
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [isMounted,    setIsMounted]    = useState(false)
  const [imageError,   setImageError]   = useState<string | null>(null)
  const [zoom,         setZoom]         = useState(1)
  const [panX,         setPanX]         = useState(0)
  const [panY,         setPanY]         = useState(0)

  useEffect(() => { setIsMounted(true) }, [])

  const resetView = useCallback(() => {
    setZoom(1); setPanX(0); setPanY(0)
  }, [])

  const zoomIn  = useCallback(() => setZoom(z => Math.min(z * 1.25, 6)), [])
  const zoomOut = useCallback(() => {
    const nz = Math.max(zoom * 0.8, 1)
    setZoom(nz)
    if (nz <= 1) { setPanX(0); setPanY(0) }
  }, [zoom])

  const scaleToCanvas = useCallback((
    bbox: BBoxData, canvasW: number, canvasH: number
  ) => ({
    x:      bbox.x      * (canvasW / (bbox.image_width  || canvasW)),
    y:      bbox.y      * (canvasH / (bbox.image_height || canvasH)),
    width:  bbox.width  * (canvasW / (bbox.image_width  || canvasW)),
    height: bbox.height * (canvasH / (bbox.image_height || canvasH)),
  }), [])

  const scaleToImage = useCallback((
    x: number, y: number, width: number, height: number,
    canvasW: number, canvasH: number, imageW: number, imageH: number
  ): BBoxData => ({
    x:      x      / canvasW * imageW,
    y:      y      / canvasH * imageH,
    width:  width  / canvasW * imageW,
    height: height / canvasH * imageH,
    format: 'xywh', image_width: imageW, image_height: imageH,
    coordinate_space: 'raw_image',
  }), [])

  // ── Draw ──────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvasSize
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0f1623'
    ctx.fillRect(0, 0, width, height)

    if (!imageRef.current || !imagesLoaded) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(imageError ? `Error: ${imageError}` : 'Loading image...', width / 2, height / 2)
      return
    }

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    ctx.drawImage(imageRef.current, 0, 0, width, height)

    if (showGradcam && gradcamRef.current) {
      ctx.globalAlpha = 0.5
      ctx.drawImage(gradcamRef.current, 0, 0, width, height)
      ctx.globalAlpha = 1.0
    }

    if (showAiBbox && aiBbox) {
      const s = scaleToCanvas(aiBbox, width, height)
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth   = 2 / zoom
      ctx.setLineDash([6 / zoom, 3 / zoom])
      ctx.strokeRect(s.x, s.y, s.width, s.height)
      ctx.setLineDash([])
      ctx.fillStyle = '#eab308'
      ctx.font = `bold ${11 / zoom}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('AI BBox', s.x + 4 / zoom, s.y - 4 / zoom)
    }

    if (showNewBbox && currentBbox) {
      const s  = scaleToCanvas(currentBbox, width, height)
      const hs = 6 / zoom
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth   = 2.5 / zoom
      ctx.strokeRect(s.x, s.y, s.width, s.height)
      ctx.fillStyle = '#22c55e'
      ;[
        [s.x, s.y], [s.x + s.width, s.y],
        [s.x, s.y + s.height], [s.x + s.width, s.y + s.height],
      ].forEach(([cx, cy]) => ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs))
      ctx.font = `bold ${11 / zoom}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('Admin BBox', s.x + 4 / zoom, s.y - 4 / zoom)
    }

    ctx.restore()
  }, [
    canvasSize, imagesLoaded, imageError,
    showGradcam, showAiBbox, showNewBbox,
    aiBbox, currentBbox, scaleToCanvas,
    zoom, panX, panY,
  ])

  useEffect(() => { draw() }, [draw])

  // ── Load images ───────────────────────────────────────────
  useEffect(() => {
    if (!rawImageUrl) { console.warn('⚠️ ImageCanvas: no rawImageUrl provided'); return }
    console.log('🖼️ Loading:', rawImageUrl.substring(0, 80) + '...')
    setImageError(null); setImagesLoaded(false); resetView()

    const img = new Image()
    img.src   = rawImageUrl
    img.onload = () => {
      console.log('✅ Loaded:', img.naturalWidth, 'x', img.naturalHeight)
      imageRef.current = img
      const maxW   = containerRef.current?.clientWidth || 600
      const ratio  = img.naturalHeight / img.naturalWidth
      const newW   = Math.min(maxW, img.naturalWidth)
      setCanvasSize({ width: newW, height: newW * ratio })
      if (gradcamUrl) {
        const gc = new Image()
        gc.src   = gradcamUrl
        gc.onload  = () => { gradcamRef.current = gc; setImagesLoaded(true) }
        gc.onerror = () => { setImagesLoaded(true) }
      } else { setImagesLoaded(true) }
    }
    img.onerror = () => { setImageError('Failed to load — URL may be expired'); setImagesLoaded(true) }
  }, [rawImageUrl, gradcamUrl, resetView])

  // ── Wheel zoom ────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const mx     = (e.clientX - rect.left) * (canvas.width  / rect.width)
    const my     = (e.clientY - rect.top)  * (canvas.height / rect.height)
    const delta  = e.deltaY > 0 ? 0.9 : 1.1
    const nz     = Math.min(Math.max(zoom * delta, 1), 6)
    setZoom(nz)
    if (nz <= 1) { setPanX(0); setPanY(0) }
    else { setPanX(mx - (mx - panX) * (nz / zoom)); setPanY(my - (my - panY) * (nz / zoom)) }
  }, [zoom, panX, panY])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Canvas pos (zoom aware) ───────────────────────────────
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * (canvas.width  / rect.width)  - panX) / zoom,
      y: ((e.clientY - rect.top)  * (canvas.height / rect.height) - panY) / zoom,
    }
  }, [zoom, panX, panY])

  // ── Mouse events ──────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault(); setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
      return
    }
    if (isDrawMode && e.button === 0) {
      const pos = getCanvasPos(e)
      drawingRef.current = { isDrawing: true, startX: pos.x, startY: pos.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanX(panStartRef.current.panX + e.clientX - panStartRef.current.x)
      setPanY(panStartRef.current.panY + e.clientY - panStartRef.current.y)
      return
    }
    if (!isDrawMode || !drawingRef.current.isDrawing) return
    const pos = getCanvasPos(e)
    const { startX, startY } = drawingRef.current
    draw()
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.save(); ctx.translate(panX, panY); ctx.scale(zoom, zoom)
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5 / zoom
    ctx.setLineDash([4 / zoom, 2 / zoom])
    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY)
    ctx.setLineDash([]); ctx.restore()
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) { setIsPanning(false); return }
    if (!isDrawMode || !drawingRef.current.isDrawing) return
    drawingRef.current.isDrawing = false
    const pos    = getCanvasPos(e)
    const { startX, startY } = drawingRef.current
    const x      = Math.min(startX, pos.x)
    const y      = Math.min(startY, pos.y)
    const width  = Math.abs(pos.x - startX)
    const height = Math.abs(pos.y - startY)
    if (width < 10 || height < 10) return
    const image = imageRef.current
    onChange(scaleToImage(x, y, width, height, canvasSize.width, canvasSize.height,
      image?.naturalWidth || canvasSize.width, image?.naturalHeight || canvasSize.height))
    setIsDrawMode(false)
  }

  const getCursor = () => {
    if (isPanning)  return 'cursor-grabbing'
    if (isDrawMode) return 'cursor-crosshair'
    if (zoom > 1)   return 'cursor-grab'
    return 'cursor-default'
  }

  if (!isMounted) return null

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Controls row ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">

        {/* Visibility toggles */}
        <ToggleButton label="AI BBox"    active={showAiBbox}  color="text-yellow-400" onClick={() => setShowAiBbox(p => !p)}  />
        <ToggleButton label="GradCAM"    active={showGradcam} color="text-purple-400" onClick={() => setShowGradcam(p => !p)} />
        <ToggleButton label="Admin BBox" active={showNewBbox} color="text-green-400"  onClick={() => setShowNewBbox(p => !p)} />

        <div className="h-4 w-px bg-[#2d3748] mx-1" />

        {/* Draw mode — keyboard shortcut hint */}
        <button
          onClick={() => { setIsDrawMode(p => !p); setIsPanning(false) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs
                      font-medium rounded-lg border transition-colors cursor-pointer
                      ${isDrawMode
                        ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : 'bg-[#1e2736] border-[#2d3748] text-white hover:bg-[#2d3748]'
                      }`}
        >
          {isDrawMode ? '✏️ Drawing...' : '✏️ Draw BBox'}
          <kbd className="px-1 py-0.5 bg-black/30 rounded text-[10px]
                           font-mono opacity-60">
            D
          </kbd>
        </button>

        {/* Clear admin bbox — only shows when bbox exists */}
        {currentBbox && (
          <button
            onClick={() => onChange(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                       font-medium rounded-lg border border-red-500/20
                       text-red-400 hover:bg-red-500/10 transition-colors
                       cursor-pointer"
          >
            ✕ Clear BBox
            <kbd className="px-1 py-0.5 bg-black/30 rounded text-[10px]
                             font-mono opacity-60">
              C
            </kbd>
          </button>
        )}

      </div>

      {/* ── Canvas container — zoom controls overlaid top-right ── */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative rounded-lg overflow-hidden
                   border border-[#1e2736] bg-[#0f1623]"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsPanning(false)}
          className={`w-full h-full object-contain block select-none
                      ${getCursor()}`}
        />

        {/* ── Zoom controls — top right of canvas (red box position) ── */}
        <div className="absolute top-2 right-2 flex items-center gap-1
                         bg-black/60 backdrop-blur-sm border border-white/10
                         rounded-lg px-1 py-1">
          <button
            onClick={zoomIn}
            title="Zoom in (scroll up)"
            className="w-7 h-7 flex items-center justify-center text-sm
                       text-muted-foreground hover:text-white
                       hover:bg-white/10 rounded transition-colors cursor-pointer"
          >
            +
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center
                            tabular-nums font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomOut}
            title="Zoom out (scroll down)"
            className="w-7 h-7 flex items-center justify-center text-sm
                       text-muted-foreground hover:text-white
                       hover:bg-white/10 rounded transition-colors cursor-pointer"
          >
            −
          </button>
          {(zoom !== 1 || panX !== 0 || panY !== 0) && (
            <>
              <div className="w-px h-4 bg-white/10 mx-0.5" />
              <button
                onClick={resetView}
                title="Reset view"
                className="px-2 h-7 text-xs text-muted-foreground
                           hover:text-white hover:bg-white/10 rounded
                           transition-colors cursor-pointer"
              >
                Reset
              </button>
            </>
          )}
        </div>

        {/* Draw mode hint */}
        {isDrawMode && (
          <div className="absolute top-2 left-2 bg-black/70 text-green-400
                           text-xs px-2 py-1 rounded pointer-events-none">
            Click and drag to draw bounding box · <kbd>Esc</kbd> to cancel
          </div>
        )}

        {/* Pan hint when zoomed */}
        {zoom > 1 && !isDrawMode && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-slate-400
                           text-xs px-2 py-1 rounded pointer-events-none">
            Alt+drag or middle mouse to pan
          </div>
        )}

        {/* Loading spinner */}
        {!imagesLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center
                           bg-[#0f1623]/80">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-white/20
                               border-t-white rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">
                Loading image...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── BBox coordinates comparison ── */}
      {(aiBbox || currentBbox) && (
        <div className="shrink-0 space-y-2">

          {/* AI BBox */}
          {aiBbox && (
            <div>
              <p className="text-[10px] text-yellow-400 uppercase tracking-wider
                             font-semibold mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                AI BBox (original)
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'X', value: Math.round(aiBbox.x)      },
                  { label: 'Y', value: Math.round(aiBbox.y)      },
                  { label: 'W', value: Math.round(aiBbox.width)  },
                  { label: 'H', value: Math.round(aiBbox.height) },
                ].map(({ label, value }) => (
                  <div key={label}
                    className="bg-yellow-500/5 border border-yellow-500/20
                                rounded-lg p-2 text-center">
                    <div className="text-[10px] text-yellow-400/60">{label}</div>
                    <div className="text-xs font-mono text-yellow-400 font-medium">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin BBox */}
          {currentBbox ? (
            <div>
              <p className="text-[10px] text-green-400 uppercase tracking-wider
                             font-semibold mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                Admin BBox (corrected)
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'X', value: Math.round(currentBbox.x),      aiVal: aiBbox ? Math.round(aiBbox.x)      : null },
                  { label: 'Y', value: Math.round(currentBbox.y),      aiVal: aiBbox ? Math.round(aiBbox.y)      : null },
                  { label: 'W', value: Math.round(currentBbox.width),  aiVal: aiBbox ? Math.round(aiBbox.width)  : null },
                  { label: 'H', value: Math.round(currentBbox.height), aiVal: aiBbox ? Math.round(aiBbox.height) : null },
                ].map(({ label, value, aiVal }) => {
                  const changed = aiVal !== null && value !== aiVal
                  return (
                    <div key={label}
                      className={`rounded-lg p-2 text-center border
                                   ${changed
                                     ? 'bg-green-500/10 border-green-500/30'
                                     : 'bg-[#1e2736] border-[#2d3748]'
                                   }`}>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                      <div className={`text-xs font-mono font-medium
                                        ${changed ? 'text-green-400' : 'text-white'}`}>
                        {value}
                      </div>
                      {changed && aiVal !== null && (
                        <div className="text-[9px] text-muted-foreground line-through">
                          {aiVal}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-dashed
                             border-[#2d3748] text-center">
              <p className="text-xs text-muted-foreground">
                No admin bbox drawn yet
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Press <kbd className="px-1 bg-[#1e2736] rounded text-[10px]">D</kbd> or
                click "✏️ Draw BBox" to correct the nodule location
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  )
}