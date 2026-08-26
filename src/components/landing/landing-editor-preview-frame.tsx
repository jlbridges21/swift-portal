"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DESKTOP_WIDTH = 1280;
/** Artboard padding inside the canvas measure area. */
const CANVAS_PAD = 24;

/**
 * Landing preview canvas. Always renders at desktop width (1280px), then Fit-scales
 * from the measured pane so CSS breakpoints match the live page.
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
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(900);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
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
  }, [children]);

  const scale = availableWidth > 0 ? availableWidth / DESKTOP_WIDTH : 0;
  const scaledWidth = DESKTOP_WIDTH * (scale || 0.01);
  const scaledHeight = Math.max(1, contentHeight * (scale || 0.01));

  const frame = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-white shadow-sm",
        "h-full rounded-none border-0 lg:border-0",
        "max-lg:h-[min(70dvh,40rem)] max-lg:rounded-xl max-lg:border"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          <p className="text-[11px] text-muted">
            {DESKTOP_WIDTH}px
            {scale > 0 ? ` · ${Math.round(scale * 100)}%` : ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-[#F1F5F9] px-3 py-2">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md border border-border bg-white px-2 py-1 text-[10px] text-muted">
          Desktop preview
        </div>
      </div>

      <div ref={measureRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#E2E8F0] p-6">
        <div
          className="mx-auto overflow-hidden rounded-md border border-border bg-white shadow-md"
          style={{
            width: scaledWidth,
            height: scaledHeight,
          }}
        >
          <div
            ref={contentRef}
            className="pointer-events-none origin-top-left select-none"
            style={{
              width: DESKTOP_WIDTH,
              transform: scale > 0 ? `scale(${scale})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
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

export const LANDING_PREVIEW_DESKTOP_WIDTH = DESKTOP_WIDTH;
