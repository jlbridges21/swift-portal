"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyPinchStep,
  clientToNaturalPoint,
  computeFitDisplaySize,
  findNearestPointIndex,
  naturalToDisplayPoint,
} from "@/lib/property-line/coordinates";
import type { ImagePoint } from "@/lib/property-line/types";
import type { PropertyLineAnnotation } from "@/lib/property-line/annotation";
import { savePropertyLineMedia } from "@/lib/property-line/save";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;
const TAP_MOVE_THRESHOLD_PX = 12;
const DEFAULT_LINE_COLOR = "#FF2222";
const DEFAULT_OVERLAY_OPACITY = 55;
const POINT_HIT_RADIUS_PX = 22;
const IMAGE_LOAD_TIMEOUT_MS = 10_000;
const PINCH_END_GUARD_MS = 350;

const LINE_COLOR_PRESETS = [
  { label: "Red", value: "#FF2222" },
  { label: "Blue", value: "#2266FF" },
  { label: "Yellow", value: "#FFCC00" },
  { label: "White", value: "#FFFFFF" },
  { label: "Black", value: "#111111" },
  { label: "Green", value: "#22AA44" },
] as const;

export interface PropertyLineEditorProps {
  imageUrl: string;
  fileName: string;
  title: string;
  projectId: string | null;
  baseMediaId: string;
  editMediaId?: string | null;
  initialAnnotation?: PropertyLineAnnotation | null;
  onClose: () => void;
  onSaved?: (asset: Record<string, unknown>) => void;
}

export function PropertyLineEditor({
  imageUrl,
  fileName,
  title,
  projectId,
  baseMediaId,
  editMediaId = null,
  initialAnnotation = null,
  onClose,
  onSaved,
}: PropertyLineEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  const [points, setPoints] = useState<ImagePoint[]>(initialAnnotation?.points ?? []);
  const [finished, setFinished] = useState((initialAnnotation?.points?.length ?? 0) >= 3);
  const [lineColor, setLineColor] = useState(initialAnnotation?.lineColor ?? DEFAULT_LINE_COLOR);
  const [overlayOpacity, setOverlayOpacity] = useState(
    Math.round((initialAnnotation?.overlayAlpha ?? DEFAULT_OVERLAY_OPACITY / 100) * 100)
  );
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const panSession = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);

  const pinchSession = useRef<{
    lastDistance: number;
    lastCenterX: number;
    lastCenterY: number;
  } | null>(null);

  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const dragPointIndexRef = useRef<number | null>(null);
  const gestureGuardUntilRef = useRef(0);
  const hadMultiTouchRef = useRef(false);
  const touchPinchActiveRef = useRef(false);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const savingRef = useRef(false);
  const layoutRef = useRef({ displayWidth: 0, displayHeight: 0 });

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

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    layoutRef.current = { displayWidth, displayHeight };
  }, [displayWidth, displayHeight]);

  const getTransform = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      panX: panRef.current.x,
      panY: panRef.current.y,
      zoom: zoomRef.current,
      displayWidth,
      displayHeight,
      naturalWidth: naturalSize.w,
      naturalHeight: naturalSize.h,
      viewportCenterX: rect ? rect.left + rect.width / 2 : 0,
      viewportCenterY: rect ? rect.top + rect.height / 2 : 0,
    };
  }, [displayWidth, displayHeight, naturalSize]);

  const applyViewTransform = useCallback((nextZoom: number, panX: number, panY: number) => {
    zoomRef.current = nextZoom;
    panRef.current = { x: panX, y: panY };
    setZoom(nextZoom);
    setPan({ x: panX, y: panY });
  }, []);

  const processPinchStep = useCallback(
    (centerX: number, centerY: number, distance: number) => {
      const session = pinchSession.current;
      if (!session) return;

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { displayWidth: dw, displayHeight: dh } = layoutRef.current;
      const result = applyPinchStep({
        prevDistance: session.lastDistance,
        prevCenterX: session.lastCenterX,
        prevCenterY: session.lastCenterY,
        currentDistance: distance,
        currentCenterX: centerX,
        currentCenterY: centerY,
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
        displayWidth: dw,
        displayHeight: dh,
        viewportCenterX: rect.left + rect.width / 2,
        viewportCenterY: rect.top + rect.height / 2,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      });

      applyViewTransform(result.zoom, result.panX, result.panY);
      setIsPanning(true);
      session.lastDistance = distance;
      session.lastCenterX = centerX;
      session.lastCenterY = centerY;
    },
    [applyViewTransform]
  );

  const startPinchSessionAt = useCallback((centerX: number, centerY: number, distance: number) => {
    pinchSession.current = {
      lastDistance: distance,
      lastCenterX: centerX,
      lastCenterY: centerY,
    };
    hadMultiTouchRef.current = true;
    panSession.current = null;
    dragPointIndexRef.current = null;
    setDraggingPointIndex(null);
    setIsDraggingPoint(false);
  }, []);

  const pinchHandlersRef = useRef({ processPinchStep, startPinchSessionAt });

  useEffect(() => {
    pinchHandlersRef.current = { processPinchStep, startPinchSessionAt };
  }, [processPinchStep, startPinchSessionAt]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const touchPairCentroid = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const touchPairDistance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (savingRef.current) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const center = touchPairCentroid(e.touches);
        const dist = touchPairDistance(e.touches);
        touchPinchActiveRef.current = true;
        pinchHandlersRef.current.startPinchSessionAt(center.x, center.y, dist);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (savingRef.current) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const center = touchPairCentroid(e.touches);
        const dist = touchPairDistance(e.touches);
        if (!pinchSession.current) {
          touchPinchActiveRef.current = true;
          pinchHandlersRef.current.startPinchSessionAt(center.x, center.y, dist);
        }
        pinchHandlersRef.current.processPinchStep(center.x, center.y, dist);
      }
    };

    const endTouchPinch = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchSession.current = null;
        if (touchPinchActiveRef.current) {
          touchPinchActiveRef.current = false;
          gestureGuardUntilRef.current = Date.now() + PINCH_END_GUARD_MS;
          hadMultiTouchRef.current = false;
          setIsPanning(false);
        }
      }
      if (e.touches.length === 0) {
        panSession.current = null;
        activePointers.current.clear();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endTouchPinch, { passive: false });
    el.addEventListener("touchcancel", endTouchPinch, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endTouchPinch);
      el.removeEventListener("touchcancel", endTouchPinch);
    };
  }, []);

  const outsideOverlay = `rgba(0, 0, 0, ${overlayOpacity / 100})`;
  const strokeWidth = Math.max(3, displayWidth / 280);
  const pointRadius = Math.max(8, displayWidth / 100);

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
  const hasClosedPolygon = displayPoints.length >= 3;
  const closedPolygonPoints = hasClosedPolygon
    ? displayPoints.map((p) => `${p.x},${p.y}`).join(" ")
    : polylinePoints;

  const canFinish = points.length >= 3 && !finished;
  const canSave = finished && points.length >= 3;

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const adjustZoom = useCallback(
    (factor: number) => {
      const nextZoom = clampZoom(zoomRef.current * factor);
      applyViewTransform(nextZoom, panRef.current.x, panRef.current.y);
    },
    [applyViewTransform]
  );

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
    const natural = clientToNaturalPoint(clientX, clientY, getTransform());
    if (!natural) return;
    setPoints((prev) => [...prev, natural]);
    setSaveError(null);
    setStatusMessage(null);
  };

  const movePointAt = (index: number, clientX: number, clientY: number) => {
    const natural = clientToNaturalPoint(clientX, clientY, getTransform());
    if (!natural) return;
    setPoints((prev) => prev.map((p, i) => (i === index ? natural : p)));
    setSaveError(null);
  };

  const hitTestPoint = (clientX: number, clientY: number) =>
    findNearestPointIndex(clientX, clientY, getTransform(), points, POINT_HIT_RADIUS_PX);

  const pointerDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const pointerCentroid = (pts: { x: number; y: number }[]) => ({
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  });

  const beginPinchSession = () => {
    const pts = [...activePointers.current.values()];
    if (pts.length < 2) return;

    const center = pointerCentroid(pts);
    startPinchSessionAt(center.x, center.y, pointerDistance(pts[0], pts[1]));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (saving || touchPinchActiveRef.current) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (activePointers.current.size === 2 && e.pointerType !== "touch") {
      beginPinchSession();
      return;
    }

    if (e.pointerType === "touch" && activePointers.current.size >= 2) {
      return;
    }

    if (finished && points.length > 0 && activePointers.current.size === 1) {
      const pointIndex = hitTestPoint(e.clientX, e.clientY);
      if (pointIndex !== null) {
        dragPointIndexRef.current = pointIndex;
        setDraggingPointIndex(pointIndex);
        setIsDraggingPoint(true);
        panSession.current = null;
        return;
      }
    }

    panSession.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: panRef.current.x,
      originPanY: panRef.current.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (saving || touchPinchActiveRef.current) return;
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (dragPointIndexRef.current !== null && activePointers.current.size === 1) {
      movePointAt(dragPointIndexRef.current, e.clientX, e.clientY);
      return;
    }

    if (activePointers.current.size >= 2 && e.pointerType !== "touch") {
      if (!pinchSession.current) {
        beginPinchSession();
      }

      const pts = [...activePointers.current.values()];
      const center = pointerCentroid(pts);
      processPinchStep(center.x, center.y, pointerDistance(pts[0], pts[1]));
      return;
    }

    const session = panSession.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) {
      session.moved = true;
      if (session.pointerType === "mouse") {
        setIsPanning(true);
        setPan({ x: session.originPanX + dx, y: session.originPanY + dy });
      }
      return;
    }

    if (finished && dragPointIndexRef.current === null && !session.moved) {
      setHoveredPointIndex(hitTestPoint(e.clientX, e.clientY));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (touchPinchActiveRef.current) {
      activePointers.current.delete(e.pointerId);
      return;
    }

    const wasMultiTouch = hadMultiTouchRef.current;
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size === 1 && wasMultiTouch) {
      pinchSession.current = null;
      panSession.current = null;
      dragPointIndexRef.current = null;
      setDraggingPointIndex(null);
      setIsDraggingPoint(false);
    }

    if (activePointers.current.size >= 2) {
      beginPinchSession();
    } else {
      pinchSession.current = null;
    }

    if (dragPointIndexRef.current !== null) {
      dragPointIndexRef.current = null;
      setDraggingPointIndex(null);
      setIsDraggingPoint(false);
      panSession.current = null;
      if (activePointers.current.size === 0) {
        setIsPanning(false);
        if (wasMultiTouch) {
          gestureGuardUntilRef.current = Date.now() + PINCH_END_GUARD_MS;
          hadMultiTouchRef.current = false;
        }
      }
      return;
    }

    const session = panSession.current;
    if (session?.pointerId === e.pointerId) {
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const moved = session.moved || Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX;
      const gestureBlocked =
        wasMultiTouch || touchPinchActiveRef.current || Date.now() < gestureGuardUntilRef.current;

      if (!moved && !finished && !gestureBlocked && activePointers.current.size === 0) {
        addPointAt(e.clientX, e.clientY);
      }

      panSession.current = null;
    }

    if (activePointers.current.size === 0) {
      setIsPanning(false);
      pinchSession.current = null;
      if (wasMultiTouch) {
        gestureGuardUntilRef.current = Date.now() + PINCH_END_GUARD_MS;
        hadMultiTouchRef.current = false;
      }
    }
  };

  const onPointerLeave = () => {
    if (!isDraggingPoint) {
      setHoveredPointIndex(null);
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
      const asset = await savePropertyLineMedia({
        imageUrl,
        baseMediaId,
        editMediaId,
        points,
        projectId,
        sourceFileName: fileName,
        sourceTitle: title,
        lineColor,
        overlayAlpha: overlayOpacity / 100,
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
      className="fixed inset-0 z-[300] flex flex-col bg-slate-950 text-white"
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
          isPanning || isDraggingPoint
            ? "cursor-grabbing"
            : hoveredPointIndex !== null
              ? "cursor-grab"
              : zoom !== 1
                ? "cursor-grab"
                : "cursor-crosshair"
        )}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
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
                {hasClosedPolygon && (
                  <>
                    <defs>
                      <mask id="property-line-outside-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <polygon points={closedPolygonPoints} fill="black" />
                      </mask>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill={outsideOverlay}
                      mask="url(#property-line-outside-mask)"
                    />
                  </>
                )}

                {displayPoints.length >= 2 && (
                  <polyline
                    points={hasClosedPolygon ? closedPolygonPoints : polylinePoints}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}

                {hasClosedPolygon && (
                  <polygon
                    points={closedPolygonPoints}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                )}

                {displayPoints.map((p, i) => (
                  <circle
                    key={`pt-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={pointRadius}
                    fill={lineColor}
                    stroke={hoveredPointIndex === i || draggingPointIndex === i ? "#ffffff" : "#ffffffcc"}
                    strokeWidth={hoveredPointIndex === i || draggingPointIndex === i ? 2.5 : 1.5}
                  />
                ))}
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute right-3 top-3 hidden flex-col gap-2 md:flex">
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

        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 md:hidden">
          Pinch to zoom · Two fingers to pan
        </p>
        {zoom !== 1 && (
          <p className="pointer-events-none absolute bottom-3 left-3 hidden rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 md:block">
            Drag to pan · Scroll to zoom
          </p>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-white/10 bg-slate-900/95 px-3 py-3">
        {(statusMessage || saveError) && (
          <p className={cn("text-center text-xs", saveError ? "text-red-300" : "text-white/70")}>
            {saveError ?? statusMessage}
          </p>
        )}

        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-white/70">Line Color</p>
            <div className="flex flex-wrap items-center gap-2">
              {LINE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={`${preset.label} line color`}
                  disabled={saving}
                  onClick={() => setLineColor(preset.value)}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full border-2 transition touch-manipulation",
                    lineColor === preset.value ? "border-white scale-110" : "border-white/20 hover:border-white/50"
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
              <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/20 hover:border-white/50 touch-manipulation">
                <span className="sr-only">Custom color</span>
                <input
                  type="color"
                  value={lineColor}
                  disabled={saving}
                  onChange={(e) => setLineColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className="h-full w-full rounded-full"
                  style={{
                    background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="property-line-dim" className="text-xs font-medium text-white/70">
                Background Dim
              </label>
              <span className="text-xs tabular-nums text-white/50">{overlayOpacity}%</span>
            </div>
            <input
              id="property-line-dim"
              type="range"
              min={0}
              max={85}
              step={1}
              value={overlayOpacity}
              disabled={saving}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-blue-500"
            />
          </div>
        </div>

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
            ? "Drag points to adjust the outline. Original photo is preserved when saving."
            : "Tap to place points around the property. Clicks outside the image snap to the nearest edge."}
        </p>
      </footer>
    </div>
  );
}
