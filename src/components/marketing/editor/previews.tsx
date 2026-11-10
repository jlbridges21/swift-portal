"use client";

import { useEffect, useState } from "react";
import { ListingWebsite } from "@/components/marketing/website/listing-website";
import { renderSocialAsset, type SocialRenderInput } from "@/components/marketing/social/templates";
import type { ListingView } from "@/lib/marketing/view-model";
import { cn } from "@/lib/utils";

/** Width of whichever element the returned callback ref is currently attached to. */
function useWidth<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [el]);
  return { ref, width };
}

const DESKTOP_WIDTH = 1280;

/**
 * Website preview. Desktop renders the real 1280px layout zoomed to fit the pane; mobile
 * renders at 390px in a phone frame. The site uses container queries, so both are the true
 * responsive layouts, updated on every keystroke.
 */
export function WebsitePreview({ view, device, ribbon }: { view: ListingView; device: "desktop" | "mobile"; ribbon?: string | null }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  if (device === "mobile") {
    // On an actual phone the pane is already phone-sized: show the site edge to edge.
    if (width && width < 440) {
      return (
        <div ref={ref} className="h-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-white">
          <ListingWebsite view={view} preview previewRibbon={ribbon} />
        </div>
      );
    }
    return (
      <div ref={ref} className="flex h-full justify-center overflow-hidden py-4">
        <div className="relative h-full max-h-[860px] w-[390px] max-w-full overflow-hidden rounded-[44px] border-[10px] border-slate-900 bg-white shadow-2xl">
          <div className="absolute left-1/2 top-2 z-40 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="h-full overflow-y-auto overscroll-contain">
            <ListingWebsite view={view} preview previewRibbon={ribbon} />
          </div>
        </div>
      </div>
    );
  }
  const zoom = width ? Math.min(1, width / DESKTOP_WIDTH) : 0.6;
  return (
    <div ref={ref} className="h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-slate-50 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      <div className="h-[calc(100%-2rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
        <div style={{ width: DESKTOP_WIDTH, zoom }}>
          <ListingWebsite view={view} preview previewRibbon={ribbon} />
        </div>
      </div>
    </div>
  );
}

/** A social asset rendered at full pixel size, scaled down with CSS to `displayWidth`. */
export function SocialCanvas({ input, displayWidth, className }: { input: SocialRenderInput; displayWidth: number; className?: string }) {
  const scale = displayWidth / input.width;
  return (
    <div className={cn("relative overflow-hidden bg-slate-100", className)} style={{ width: displayWidth, height: input.height * scale }}>
      <div style={{ width: input.width, height: input.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{renderSocialAsset(input)}</div>
    </div>
  );
}

export function FitSocialCanvas({ input, maxHeight }: { input: SocialRenderInput; maxHeight: number }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const byHeight = (maxHeight / input.height) * input.width;
  const display = Math.max(120, Math.min(width || 320, byHeight));
  return (
    <div ref={ref} className="flex w-full justify-center">
      <SocialCanvas input={input} displayWidth={display} className="rounded-lg shadow-xl ring-1 ring-black/5" />
    </div>
  );
}
