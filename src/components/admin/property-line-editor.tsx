"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clientToNaturalPoint,
  computeFitDisplaySize,
  naturalToDisplayPoint,
} from "@/lib/property-line/coordinates";
import type { ImagePoint } from "@/lib/property-line/types";
import { savePropertyLineAsNewMedia } from "@/lib/property-line/save";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const TAP_MOVE_THRESHOLD_PX = 12;
const PROPERTY_LINE_COLOR = "#FF2222";
const OUTSIDE_OVERLAY = "rgba(0, 0, 0, 0.55)";
const IMAGE_LOAD_TIMEOUT_MS = 10_000;

export interface PropertyLineEditorProps {
  imageUrl: string;
  fileName: string;
  title: string;
  projectId: string | null;
  onClose: () => void;
  onSaved?: (asset: Record<string, unknown>) => void;
}

export function PropertyLineEditor({
  imageUrl,
  fileName,
  title,
  projectId,
  onClose,
  onSaved,
}: PropertyLineEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  const [points, setPoints] = useState<ImagePoint[]>([]);
  const [finished, setFinished] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const panSession = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);

  const pinchSession = useRef<{
    startDistance: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const activePointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewportSize({ w: rect.width, h: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setImageLoaded(false);
    setLoadError(null);
    setNaturalSize({ w: 0, h: 0 });

    if (!imageUrl) {
      setLoadError("No image URL provided.");
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[property-line] loading image", imageUrl);
    }

    let cancelled = false;
    let loaded = false;
    const img = new Image();

    if (!imageUrl.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled || loaded) return;
      const message = "Image load timed out after 10 seconds. Try again.";
      setLoadError(message);
      if (process.env.NODE_ENV === "development") {
        console.error("[property-line] load timeout", { imageUrl });
      }
    }, IMAGE_LOAD_TIMEOUT_MS);

    img.onload = () => {
      if (cancelled) return;
      loaded = true;
      window.clearTimeout(timeoutId);

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (process.env.NODE_ENV === "development") {
        console.info("[property-line] image loaded", { naturalWidth: w, naturalHeight: h, imageUrl });
      }

      if (w <= 0 || h <= 0) {
        setLoadError("Image loaded but dimensions are unavailable.");
        return;
      }

      setNaturalSize({ w, h });
      setImageLoaded(true);
      setLoadError(null);
    };

    img.onerror = () => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      const message = "Image failed to load.";
      setLoadError(message);
      if (process.env.NODE_ENV === "development") {
        console.error("[property-line] image error", { imageUrl });
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [imageUrl, retryCount]);

  const effectiveViewport = useMemo(
    () => ({
      w: viewportSize.w || (typeof window !== "undefined" ? window.innerWidth : 0),
      h: viewportSize.h || (typeof window !== "undefined" ? Math.max(window.innerHeight - 220, 320) : 0),
    }),
    [viewportSize]
  );

  const fit = useMemo(
    () => computeFitDisplaySize(naturalSize.w, naturalSize.h, effectiveViewport.w, effectiveViewport.h),
    [naturalSize, effectiveViewport]
  );

  const displayWidth = fit.width;
  const displayHeight = fit.height;

  const getTransform = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      panX: pan.x,
      panY: pan.y,
      zoom,
      displayWidth,
      displayHeight,
      naturalWidth: naturalSize.w,
      naturalHeight: naturalSize.h,
      viewportCenterX: rect ? rect.left + rect.width / 2 : 0,
      viewportCenterY: rect ? rect.top + rect.height / 2 : 0,
    };
  }, [pan, zoom, displayWidth, displayHeight, naturalSize]);

  const displayPoints = useMemo(
    () =>
      points.map((p) =>
        naturalToDisplayPoint(p, {
          displayWidth,
          displayHeight,
          naturalWidth: naturalSize.w,
          naturalHeight: naturalSize.h,
        })
      ),
    [points, displayWidth, displayHeight, naturalSize]
  );

  const polylinePoints = displayPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const polygonPoints =
    finished && displayPoints.length >= 3
      ? displayPoints.map((p) => `${p.x},${p.y}`).join(" ")
      : polylinePoints;

  const canFinish = points.length >= 3 && !finished;
  const canSave = finished && points.length >= 3;

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const adjustZoom = useCallback((factor: number) => {
    setZoom((z) => clampZoom(z * factor));
  }, []);

  const handleUndo = () => {
    setSaveError(null);
    setFinished(false);
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setSaveError(null);
    setFinished(false);
    setPoints([]);
  };

  const handleFinish = () => {
    if (points.length < 3) return;
    setFinished(true);
    setStatusMessage("Outline complete. Outside area darkened.");
  };

  const addPointAt = (clientX: number, clientY: number) => {
    if (finished) return;
    const transform = getTransform();
    const natural = clientToNaturalPoint(clientX, clientY, transform);
    if (!natural) return;
    setPoints((prev) => [...prev, natural]);
    setSaveError(null);
    setStatusMessage(null);
  };

  const pointerDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    if (saving) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      const rect = viewportRef.current?.getBoundingClientRect();
      pinchSession.current = {
        startDistance: pointerDistance(pts[0], pts[1]),
        startZoom: zoom,
        startPanX: pan.x,
        startPanY: pan.y,
        centerX: rect ? rect.left + rect.width / 2 : 0,
        centerY: rect ? rect.top + rect.height / 2 : 0,
      };
      panSession.current = null;
      return;
    }

    panSession.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (saving) return;
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size >= 2 && pinchSession.current) {
      const pts = [...activePointers.current.values()];
      const dist = pointerDistance(pts[0], pts[1]);
      const ratio = dist / pinchSession.current.startDistance;
      setZoom(clampZoom(pinchSession.current.startZoom * ratio));
      setIsPanning(true);
      return;
    }

    const session = panSession.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) {
      session.moved = true;
      setIsPanning(true);
      setPan({ x: session.originPanX + dx, y: session.originPanY + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    pinchSession.current = activePointers.current.size >= 2 ? pinchSession.current : null;

    const session = panSession.current;
    if (session?.pointerId === e.pointerId) {
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const moved = session.moved || Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX;

      if (!moved && !finished) {
        addPointAt(e.clientX, e.clientY);
      }

      panSession.current = null;
    }

    if (activePointers.current.size === 0) {
      setIsPanning(false);
      pinchSession.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    adjustZoom(factor);
  };

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    setStatusMessage("Preparing image…");
    try {
      const asset = await savePropertyLineAsNewMedia({
        imageUrl,
        points,
        projectId,
        sourceFileName: fileName,
        sourceTitle: title,
        onProgress: setStatusMessage,
      });
      onSaved?.(asset);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save edited image.");
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  }

  const handleRetryLoad = () => {
    setRetryCount((count) => count + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-slate-950 text-white touch-none"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Property Line Tool</p>
          <p className="truncate text-xs text-white/60">{fileName}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={onClose}
          disabled={saving}
        >
          <X className="h-4 w-4" /> Back
        </Button>
      </header>

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-black",
          isPanning ? "cursor-grabbing" : zoom > 1 ? "cursor-grab" : "cursor-crosshair"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {!imageLoaded && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading image…</p>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-medium text-red-300">Image failed to load</p>
            <p className="text-xs text-white/60">{loadError}</p>
            {process.env.NODE_ENV === "development" && (
              <p className="max-w-full break-all font-mono text-[10px] text-white/40">{imageUrl}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={handleRetryLoad}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={onClose}
              >
                Back
              </Button>
            </div>
          </div>
        )}

        {imageLoaded && displayWidth > 0 && displayHeight > 0 && (
          <div
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="block h-full w-full select-none"
              draggable={false}
            />

            <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${displayWidth} ${displayHeight}`}
                preserveAspectRatio="none"
              >
                {finished && displayPoints.length >= 3 && (
                  <>
                    <defs>
                      <mask id="property-line-outside-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <polygon points={polygonPoints} fill="black" />
                      </mask>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill={OUTSIDE_OVERLAY}
                      mask="url(#property-line-outside-mask)"
                    />
                  </>
                )}

                {displayPoints.length >= 2 && (
                  <polyline
                    points={finished ? polygonPoints : polylinePoints}
                    fill="none"
                    stroke={PROPERTY_LINE_COLOR}
                    strokeWidth={Math.max(3, displayWidth / 280)}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}

                {finished && displayPoints.length >= 3 && (
                  <polygon
                    points={polygonPoints}
                    fill="none"
                    stroke={PROPERTY_LINE_COLOR}
                    strokeWidth={Math.max(3, displayWidth / 280)}
                    strokeLinejoin="round"
                  />
                )}

                {displayPoints.map((p, i) => (
                  <circle
                    key={`pt-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(5, displayWidth / 120)}
                    fill={PROPERTY_LINE_COLOR}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ))}
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pointer-events-auto min-h-11 min-w-11 border-white/20 bg-black/60 p-0 text-white hover:bg-black/80"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              adjustZoom(1.2);
            }}
            disabled={saving || zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pointer-events-auto min-h-11 min-w-11 border-white/20 bg-black/60 p-0 text-white hover:bg-black/80"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              adjustZoom(1 / 1.2);
            }}
            disabled={saving || zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <Minus className="h-5 w-5" />
          </Button>
        </div>

        {zoom > 1 && (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80">
            Drag to pan · Pinch or scroll to zoom
          </p>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-white/10 bg-slate-900/95 px-3 py-3">
        {(statusMessage || saveError) && (
          <p className={cn("text-center text-xs", saveError ? "text-red-300" : "text-white/70")}>
            {saveError ?? statusMessage}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={handleUndo}
            disabled={saving || points.length === 0}
          >
            Undo Last Point
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={handleClear}
            disabled={saving || points.length === 0}
          >
            Clear Outline
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 sm:col-span-1 col-span-2"
            onClick={handleFinish}
            disabled={saving || !canFinish}
          >
            Finish Outline
          </Button>
        </div>

        <Button
          type="button"
          variant="accent"
          className="min-h-12 w-full"
          onClick={handleSave}
          disabled={saving || !canSave}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save as New Image"
          )}
        </Button>

        <p className="text-center text-[11px] text-white/50">
          {finished
            ? "Original photo is preserved. Saving creates a new image in the same project."
            : "Tap to place points around the property. Use pinch or +/- to zoom for accuracy."}
        </p>
      </footer>
    </div>
  );
}
