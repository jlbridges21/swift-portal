"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Smartphone } from "lucide-react";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;

type ViewportMode = "desktop" | "mobile";

/**
 * Sticky live-preview chrome. Renders children at a fixed desktop (or mobile)
 * width, then scales to the measured pane — so CSS breakpoints match the real page.
 */
export function LandingEditorPreviewFrame({
  title = "Live preview",
  children,
  className,
  /** Wider flush-right pane for admin settings (breaks out of max-w containers via parent). */
  wide = false,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(900);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setPaneWidth(w);
    });
    ro.observe(el);
    setPaneWidth(el.clientWidth);
    return () => ro.disconnect();
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
  const scale = paneWidth > 0 ? paneWidth / fixedWidth : 0;
  const scaledHeight = Math.max(1, contentHeight * (scale || 0.01));

  const previewBody = (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm",
        "lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)]"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          <p className="text-[11px] text-muted">
            Same components as the live page · {viewport === "desktop" ? `${DESKTOP_WIDTH}px` : `${MOBILE_WIDTH}px`}{" "}
            → scaled
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5">
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
      </div>

      {/* Browser chrome */}
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

      <div ref={measureRef} className="min-h-0 flex-1 overflow-auto bg-[#E2E8F0] p-2 sm:p-3">
        <div
          className="mx-auto overflow-hidden rounded-md border border-border bg-white shadow-md"
          style={{
            width: paneWidth > 0 ? paneWidth : "100%",
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
    </div>
  );

  return (
    <div
      className={cn(
        "w-full",
        wide
          ? "lg:w-[min(44rem,calc(100vw-28rem))] lg:max-w-none lg:shrink-0 lg:pl-2"
          : "lg:w-[min(32rem,46%)] lg:shrink-0",
        className
      )}
    >
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
      <div className={cn(!mobileSheetOpen && "hidden lg:block")}>{previewBody}</div>
    </div>
  );
}

/** Stable ids for tests / docs. */
export const LANDING_PREVIEW_DESKTOP_WIDTH = DESKTOP_WIDTH;
export const LANDING_PREVIEW_MOBILE_WIDTH = MOBILE_WIDTH;
