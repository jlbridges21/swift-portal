"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Smartphone } from "lucide-react";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;
/** Artboard padding inside the canvas measure area (Fit mode). */
const CANVAS_PAD = 24;

type ViewportMode = "desktop" | "mobile";
type ZoomMode = "fit" | "100";

/**
 * Landing preview canvas. Renders children at a fixed desktop/mobile width, then scales
 * from the measured pane — so CSS breakpoints match the live page.
 *
 * Shell mode fills a flex parent; stack mode is document-flow with a show/hide toggle below lg.
 * No vw units — the canvas takes the flex remainder from LandingEditorShell.
 */
export function LandingEditorPreviewFrame({
  title = "Live preview",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(900);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
      // clientWidth excludes scrollbar — never use vw.
      const w = Math.max(0, el.clientWidth - CANVAS_PAD * 2);
      setAvailableWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mobileSheetOpen]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight || el.offsetHeight || 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, viewport]);

  const fixedWidth = viewport === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH;
  const fitScale = availableWidth > 0 ? availableWidth / fixedWidth : 0;
  const scale = zoom === "100" ? 1 : fitScale;
  const scaledWidth = fixedWidth * (scale || 0.01);
  const scaledHeight = Math.max(1, contentHeight * (scale || 0.01));

  const toolbar = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
        <p className="text-[11px] text-muted">
          {viewport === "desktop" ? `${DESKTOP_WIDTH}px` : `${MOBILE_WIDTH}px`}
          {zoom === "fit" && fitScale > 0 ? ` · ${Math.round(fitScale * 100)}%` : " · 100%"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5">
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              viewport === "desktop" ? "bg-accent text-white" : "text-muted hover:text-heading"
            )}
            aria-pressed={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden />
            Desktop
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              viewport === "mobile" ? "bg-accent text-white" : "text-muted hover:text-heading"
            )}
            aria-pressed={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Mobile
          </button>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5">
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-medium",
              zoom === "fit" ? "bg-accent text-white" : "text-muted hover:text-heading"
            )}
            aria-pressed={zoom === "fit"}
            onClick={() => setZoom("fit")}
          >
            Fit
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-medium",
              zoom === "100" ? "bg-accent text-white" : "text-muted hover:text-heading"
            )}
            aria-pressed={zoom === "100"}
            onClick={() => setZoom("100")}
          >
            100%
          </button>
        </div>
      </div>
    </div>
  );

  const chrome = (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-[#F1F5F9] px-3 py-2">
      <div className="flex gap-1.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />
      </div>
      <div className="min-w-0 flex-1 truncate rounded-md border border-border bg-white px-2 py-1 text-[10px] text-muted">
        {viewport === "desktop" ? "Desktop preview" : "Mobile preview"}
      </div>
    </div>
  );

  const artboard = (
    <div
      ref={measureRef}
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-auto bg-[#E2E8F0]",
        zoom === "fit" ? "p-6" : "p-4"
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-md border border-border bg-white shadow-md",
          zoom === "fit" && "mx-auto"
        )}
        style={{
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <div
          ref={contentRef}
          className="pointer-events-none origin-top-left select-none"
          style={{
            width: fixedWidth,
            transform: scale > 0 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  const frame = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-white shadow-sm",
        "h-full rounded-none border-0 lg:border-0",
        "max-lg:h-[min(70dvh,40rem)] max-lg:rounded-xl max-lg:border"
      )}
    >
      {toolbar}
      {chrome}
      {artboard}
    </div>
  );

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", "h-full w-full", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
        <p className="text-sm font-medium text-heading">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setMobileSheetOpen((o) => !o)}
        >
          {mobileSheetOpen ? "Hide preview" : "Show preview"}
        </Button>
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1", !mobileSheetOpen && "hidden lg:flex lg:flex-col")}>
        {frame}
      </div>
    </div>
  );
}

/** Stable ids for tests / docs. */
export const LANDING_PREVIEW_DESKTOP_WIDTH = DESKTOP_WIDTH;
export const LANDING_PREVIEW_MOBILE_WIDTH = MOBILE_WIDTH;
