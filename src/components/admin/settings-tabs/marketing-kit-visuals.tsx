"use client";

import { cn } from "@/lib/utils";
import type { DesignStyle, MarketingProduct } from "@/lib/marketing/model";

/** Small illustrative thumbnail for a Marketing Kit product, drawn with theme tokens only. */
export function MarketingKitProductThumb({ product, muted }: { product: MarketingProduct; muted?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-24 overflow-hidden rounded-xl border border-border bg-subtle p-3 transition-opacity sm:h-28",
        muted && "opacity-50"
      )}
    >
      {product === "website" ? (
        // Browser window: chrome bar, hero block, two lines of text.
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
          </div>
          <div className="flex flex-1 gap-2 p-2">
            <div className="flex-[3] rounded-md bg-accent-subtle" />
            <div className="flex flex-[2] flex-col gap-1.5 pt-1">
              <span className="h-1.5 w-4/5 rounded-full bg-accent/60" />
              <span className="h-1.5 w-full rounded-full bg-border" />
              <span className="h-1.5 w-2/3 rounded-full bg-border" />
            </div>
          </div>
        </div>
      ) : (
        // Three social tiles: post, story (accent), flyer.
        <div className="flex h-full gap-2">
          <div className="flex-1 rounded-lg border border-border bg-card shadow-sm" />
          <div className="flex-1 rounded-lg bg-accent-subtle shadow-sm ring-1 ring-accent/20" />
          <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-card p-1.5 shadow-sm">
            <div className="flex-1 rounded bg-subtle" />
            <span className="h-1 w-3/4 rounded-full bg-border" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini swatch of a property-website design. These colors depict the design itself (not the portal
 * theme), so they stay the same on Light, Dark and Primary-color backgrounds.
 */
const DESIGN_SWATCH: Record<DesignStyle, { top: string; body: string }> = {
  modern: { top: "#FFFFFF", body: "#E2E8F0" },
  luxury: { top: "#111111", body: "#3F3A33" },
  coastal: { top: "#FFF7ED", body: "#BAE6FD" },
};

export function MarketingKitDesignSwatch({ style }: { style: DesignStyle }) {
  const c = DESIGN_SWATCH[style];
  return (
    <span
      aria-hidden
      className="block h-12 w-full overflow-hidden rounded-lg border border-border sm:h-14"
      style={{ background: `linear-gradient(${c.top} 0 30%, ${c.body} 30% 100%)` }}
    />
  );
}
