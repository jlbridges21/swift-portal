"use client";

/**
 * Social Media Kit workspace: global settings (left) · choose + customize an asset (middle) ·
 * persistent live preview (right). Each column scrolls on its own; the preview never moves.
 * On tablets the global settings become a slide-over, and on phones the preview sits on top
 * with the asset browser below it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CalendarPlus, ChevronLeft, ChevronRight, Download, EyeOff, Loader2, Lock, Maximize2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SocialCanvas } from "@/components/marketing/editor/previews";
import { AssetControls, CarouselControls, FlyerControls } from "@/components/marketing/editor/social-controls";
import type { KitApi } from "@/components/marketing/editor/use-kit";
import { buildSocialItems, type SocialItem } from "@/lib/marketing/social-inputs";
import { FLYER_LAYOUTS, type FlyerLayout, type SocialAssetKey } from "@/lib/marketing/model";
import { flyerConfig, type ListingView } from "@/lib/marketing/view-model";

export type SocialCategory = SocialItem["group"];

const CATEGORIES: { key: SocialCategory; label: string; short: string; size: string }[] = [
  { key: "square", label: "Square posts", short: "Posts", size: "1080 × 1080 PNG" },
  { key: "story", label: "Stories", short: "Stories", size: "1080 × 1920 PNG" },
  { key: "carousel", label: "Instagram carousel", short: "Carousel", size: "1080 × 1350 PNG" },
  { key: "flyer", label: "Property flyers", short: "Flyers", size: "US Letter PDF" },
];

const THUMB_H = 148;

function shortLabel(item: SocialItem): string {
  return item.label.replace(/ Story$/, "").replace(/^Property /, "").replace(/ \(PDF\)$/, "");
}

/** Size of whichever element the returned callback ref is attached to. */
function useSize<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }));
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ width: r.width, height: r.height });
    return () => ro.disconnect();
  }, [el]);
  return { ref, ...size };
}

function isOff(item: SocialItem, includeCarousel: boolean): boolean {
  return item.status ? !item.status.enabled : !includeCarousel;
}

// ---------------------------------------------------------------------------
// Thumbnail strip (horizontal scroll, arrows, wheel → sideways)
// ---------------------------------------------------------------------------

type StripEntry = { id: string; label: string; input: SocialItem["input"]; off?: boolean; needsInfo?: boolean; selected: boolean; onClick: () => void };

function ThumbStrip({ entries, ariaLabel }: { entries: StripEntry[]; ariaLabel: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // A plain mouse wheel scrolls the strip sideways (trackpads already scroll horizontally).
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [update, entries.length]);

  // Keep the selected thumbnail in view without scrolling anything else on the page.
  const selectedId = entries.find((e) => e.selected)?.id;
  useEffect(() => {
    const el = scroller.current;
    const card = el?.querySelector<HTMLElement>(`[data-thumb="${selectedId}"]`);
    if (!el || !card) return;
    const left = card.offsetLeft - el.offsetLeft;
    const right = left + card.offsetWidth;
    if (left < el.scrollLeft + 8) el.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    else if (right > el.scrollLeft + el.clientWidth - 8) el.scrollTo({ left: right - el.clientWidth + 16, behavior: "smooth" });
  }, [selectedId]);

  const nudge = (d: -1 | 1) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={scroller} onScroll={update} className="flex snap-x scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 pb-3 pt-2 [scrollbar-width:thin]" role="listbox" aria-label={ariaLabel} aria-orientation="horizontal">
        {entries.map((e) => {
          const w = (THUMB_H / e.input.height) * e.input.width;
          return (
            <button
              key={e.id}
              type="button"
              data-thumb={e.id}
              role="option"
              aria-selected={e.selected}
              onClick={e.onClick}
              className="group shrink-0 snap-start text-left focus-visible:outline-none"
              style={{ width: w }}
              title={e.label}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg transition",
                  e.selected ? "ring-2 ring-accent ring-offset-2 ring-offset-white surface-dark:ring-offset-card" : "ring-1 ring-black/10 group-hover:ring-slate-400 group-focus-visible:ring-2 group-focus-visible:ring-accent/60"
                )}
              >
                <div className={cn((e.off || e.needsInfo) && "opacity-45")}>
                  <SocialCanvas input={e.input} displayWidth={w} />
                </div>
                {e.needsInfo ? (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-amber-100/95 px-1 py-0.5 text-center text-[9px] font-semibold text-amber-900">Needs info</span>
                ) : e.off ? (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-white/95 px-1 py-0.5 text-center text-[9px] font-semibold text-slate-600">Not in kit</span>
                ) : null}
              </div>
              <p className={cn("mt-1.5 truncate text-[11px] font-medium", e.selected ? "text-heading" : "text-muted")}>{e.label}</p>
            </button>
          );
        })}
      </div>
      {edges.left ? (
        <button type="button" onClick={() => nudge(-1)} aria-label="Scroll left" className="absolute left-1 top-[calc(50%-14px)] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 shadow-md hover:bg-white surface-dark:bg-card">
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}
      {edges.right ? (
        <button type="button" onClick={() => nudge(1)} aria-label="Scroll right" className="absolute right-1 top-[calc(50%-14px)] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 shadow-md hover:bg-white surface-dark:bg-card">
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function FittedCanvas({ input, padding = 32 }: { input: SocialItem["input"]; padding?: number }) {
  const { ref, width, height } = useSize<HTMLDivElement>();
  const scale = width && height ? Math.min((width - padding * 2) / input.width, (height - padding * 2) / input.height) : 0;
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center overflow-hidden">
      {scale > 0 ? <SocialCanvas input={input} displayWidth={Math.max(80, input.width * scale)} className="rounded-md shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5" /> : null}
    </div>
  );
}

function NeedsInfo({ item, kit }: { item: SocialItem; kit: KitApi }) {
  const canEdit = kit.state.permissions.canEdit;
  const openHouse = item.id === "sq_open_house" || item.id === "st_open_house";
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm surface-dark:bg-card">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertCircle className="h-5 w-5" />
        </span>
        <p className="mt-3 font-semibold text-heading">{item.label} needs {openHouse ? "an open house date" : "more details"}</p>
        <p className="mt-1 text-sm text-muted">{item.status?.reason ?? "Add the missing details to see this graphic."}</p>
        {openHouse && canEdit ? (
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="mt-4"
            onClick={() =>
              kit.update((o) => ({
                ...o,
                property: { ...(o.property ?? {}), openHouse: { date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), start: "13:00", end: "15:00", note: "" } },
              }))
            }
          >
            <CalendarPlus className="h-4 w-4" /> Add open house details
          </Button>
        ) : null}
        {openHouse && canEdit ? <p className="mt-2 text-[11px] text-muted">Then set the date and time under “Open house” in the middle column.</p> : null}
      </div>
    </div>
  );
}

function Fullscreen({ item, onClose, onStep, position, actions }: { item: SocialItem; onClose: () => void; onStep: (d: -1 | 1) => void; position: string; actions: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onStep(-1);
      else if (e.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onStep]);
  return (
    <div className="fixed-overlay-safe fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white" role="dialog" aria-modal="true" aria-label={`${item.label} preview`}>
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.label}</p>
          <p className="text-xs text-white/60">{position}</p>
        </div>
        <div className="[&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white">{actions}</div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close preview">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <FittedCanvas input={item.input} padding={24} />
        <button type="button" onClick={() => onStep(-1)} aria-label="Previous" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => onStep(1)} aria-label="Next" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export type SocialWorkspaceProps = {
  kit: KitApi;
  view: ListingView;
  /** Items at thumbnail resolution (every asset, including off / unavailable ones). */
  thumbItems: SocialItem[];
  /** The selected item at preview resolution. */
  focusedItem: SocialItem | null;
  selected: string;
  onSelect: (id: string) => void;
  locked: boolean;
  websiteUrl: string | null;
  settingsPanel: ReactNode;
  onOpenSettings: () => void;
  canDownload: boolean;
  downloading: string | null;
  onDownload: (item: SocialItem) => void;
  /** Shown instead of Download when the viewer must purchase first. */
  purchase: { label: string; onClick: () => void } | null;
};

export function SocialWorkspace(props: SocialWorkspaceProps) {
  const { kit, thumbItems, focusedItem, selected, onSelect } = props;
  const s = kit.state;
  const content = kit.content;
  const [expanded, setExpanded] = useState(false);
  const remembered = useRef<Partial<Record<SocialCategory, string>>>({});

  const category: SocialCategory = focusedItem?.group ?? "square";
  const inCategory = useMemo(() => thumbItems.filter((i) => i.group === category), [thumbItems, category]);
  useEffect(() => {
    if (focusedItem) remembered.current[focusedItem.group] = focusedItem.id;
  }, [focusedItem]);

  const counts = useMemo(() => {
    const m: Record<SocialCategory, number> = { square: 0, story: 0, carousel: 0, flyer: FLYER_LAYOUTS.length };
    for (const i of thumbItems) if (i.group !== "flyer") m[i.group]++;
    return m;
  }, [thumbItems]);

  const chooseCategory = (c: SocialCategory) => {
    if (c === category) return;
    const items = thumbItems.filter((i) => i.group === c);
    const prev = remembered.current[c];
    const next = items.find((i) => i.id === prev) ?? items.find((i) => !i.status || (i.status.available && i.status.enabled)) ?? items[0];
    if (next) onSelect(next.id);
  };

  // Flyer thumbnails are the layout variations of the one flyer.
  const flyerCfg = flyerConfig(content);
  const flyerVariants = useMemo(() => {
    if (category !== "flyer") return [];
    const cfg = flyerConfig(content);
    return FLYER_LAYOUTS.map((l) => {
      const c = { ...content, social: { ...content.social, flyer: { ...cfg, layout: l.key } } };
      const item = buildSocialItems({
        content: c,
        media: s.media,
        coverId: s.coverId,
        view: props.view,
        photoUrl: (id) => (id ? kit.urls.image({ kind: "media", id }, "thumb") : null),
        watermark: props.locked,
        includeAll: true,
        websiteUrl: props.websiteUrl,
      }).find((i) => i.id === "flyer");
      return { layout: l, item };
    });
  }, [category, content, s.media, s.coverId, props.view, kit.urls, props.locked, props.websiteUrl]);

  const setFlyerLayout = (layout: FlyerLayout) => {
    if (s.permissions.canEdit && layout !== flyerCfg.layout) {
      kit.update((o) => ({ ...o, social: { ...(o.social ?? {}), flyer: { ...flyerCfg, layout } } }));
    }
    onSelect("flyer");
  };

  const entries: StripEntry[] =
    category === "flyer"
      ? flyerVariants
          .filter((v) => v.item)
          .map((v) => ({
            id: `flyer:${v.layout.key}`,
            label: v.layout.label,
            input: v.item!.input,
            off: isOff(v.item!, content.social.includeCarousel),
            selected: flyerCfg.layout === v.layout.key,
            onClick: () => setFlyerLayout(v.layout.key),
          }))
      : inCategory.map((i) => ({
          id: i.id,
          label: shortLabel(i),
          input: i.input,
          off: isOff(i, content.social.includeCarousel),
          needsInfo: Boolean(i.status && !i.status.available),
          selected: i.id === focusedItem?.id,
          onClick: () => onSelect(i.id),
        }));

  // Prev / next within the category (preview header + fullscreen).
  const index = inCategory.findIndex((i) => i.id === focusedItem?.id);
  const step = useCallback(
    (d: -1 | 1) => {
      if (category === "flyer") {
        const li = FLYER_LAYOUTS.findIndex((l) => l.key === flyerCfg.layout);
        const next = FLYER_LAYOUTS[(li + d + FLYER_LAYOUTS.length) % FLYER_LAYOUTS.length]!;
        if (s.permissions.canEdit) kit.update((o) => ({ ...o, social: { ...(o.social ?? {}), flyer: { ...flyerCfg, layout: next.key } } }));
        return;
      }
      if (!inCategory.length) return;
      const next = inCategory[(index + d + inCategory.length) % inCategory.length]!;
      onSelect(next.id);
    },
    [category, flyerCfg, s.permissions.canEdit, kit, inCategory, index, onSelect]
  );

  const cat = CATEGORIES.find((c) => c.key === category)!;
  const item = focusedItem;
  const unavailable = Boolean(item?.status && !item.status.available);
  const off = item ? isOff(item, content.social.includeCarousel) : false;
  const position =
    category === "flyer"
      ? `${FLYER_LAYOUTS.find((l) => l.key === flyerCfg.layout)?.label} layout · ${cat.size}`
      : `${index + 1} of ${inCategory.length} · ${cat.size}`;

  const actions = item ? (
    <div className="flex items-center gap-2">
      {props.canDownload ? (
        <Button size="sm" variant="outline" disabled={props.downloading !== null || unavailable} onClick={() => props.onDownload(item)}>
          {props.downloading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">{item.group === "flyer" ? "Download PDF" : "Download PNG"}</span>
        </Button>
      ) : props.purchase ? (
        <Button size="sm" variant="accent" onClick={props.purchase.onClick}>
          <Lock className="h-4 w-4" /> <span className="hidden sm:inline">{props.purchase.label}</span>
        </Button>
      ) : null}
    </div>
  ) : null;

  let controls: ReactNode = null;
  if (item?.group === "carousel") {
    controls = <CarouselControls kit={kit} index={Math.max(0, Number(item.id.split("-")[1]) - 1)} onSelectIndex={(i) => onSelect(`carousel-${i + 1}`)} />;
  } else if (item?.group === "flyer") {
    controls = <FlyerControls kit={kit} />;
  } else if (item) {
    controls = <AssetControls kit={kit} assetKey={item.id as SocialAssetKey} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Column 1 — global settings (desktop) */}
      <aside className="hidden w-[320px] shrink-0 overflow-y-auto overscroll-contain border-r border-border bg-white xl:block 2xl:w-[340px] surface-dark:bg-card" aria-label="Kit settings">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Kit settings</p>
          <p className="text-[11px] text-muted">Apply to every graphic</p>
        </div>
        {props.settingsPanel}
      </aside>

      {/* Column 2 — choose + customize an asset */}
      <section className="order-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-border bg-white md:order-none md:w-[340px] md:flex-none md:shrink-0 md:overflow-hidden md:border-r lg:w-[370px] xl:w-[380px] surface-dark:bg-card" aria-label="Choose an asset to edit">
        <div className="shrink-0 border-b border-border">
          <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-3.5">
            <div>
              <h2 className="text-sm font-semibold text-heading">Choose an asset to edit</h2>
              <p className="text-[11px] text-muted">Pick a graphic, then customize it below.</p>
            </div>
            <Button size="sm" variant="outline" className="xl:hidden" onClick={props.onOpenSettings}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Kit settings
            </Button>
          </div>
          <div className="px-4 pb-1">
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 surface-dark:bg-subtle" role="tablist" aria-label="Asset type">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={category === c.key}
                  title={c.label}
                  onClick={() => chooseCategory(c.key)}
                  disabled={c.key !== "flyer" && !counts[c.key]}
                  className={cn(
                    "flex flex-col items-center rounded-md px-1 py-1.5 text-[11px] font-semibold leading-tight transition disabled:opacity-40",
                    category === c.key ? "bg-white text-heading shadow-sm surface-dark:bg-card" : "text-muted hover:text-heading"
                  )}
                >
                  {c.short}
                  <span className="mt-0.5 text-[10px] font-medium text-muted">{c.key === "flyer" ? `${counts.flyer} layouts` : counts[c.key]}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="px-4 pt-2 text-[11px] font-medium text-muted">
            {cat.label} · {cat.size}
          </p>
          <ThumbStrip entries={entries} ariaLabel={cat.label} />
        </div>
        <div className="px-4 py-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
          {item ? (
            <>
              <p className="mb-4 text-sm font-semibold text-heading">Customize · {item.group === "flyer" ? "Property Flyer" : item.label}</p>
              {controls}
            </>
          ) : null}
        </div>
      </section>

      {/* Column 3 — persistent live preview */}
      <main className="order-1 flex h-[44dvh] min-w-0 shrink-0 flex-col bg-slate-100/80 md:order-none md:h-auto md:flex-1 surface-dark:bg-background" aria-label="Live preview">
        {item ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-white px-3 py-2 sm:px-4 surface-dark:bg-card">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-heading">
                  {item.group === "flyer" ? "Property Flyer" : item.label}
                  {off && !unavailable ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 surface-dark:bg-subtle">
                      <EyeOff className="h-3 w-3" /> Not in kit
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-muted">{position}</p>
              </div>
              <div className="hidden items-center sm:flex">
                <button type="button" onClick={() => step(-1)} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-heading surface-dark:hover:bg-subtle" aria-label="Previous asset">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => step(1)} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-heading surface-dark:hover:bg-subtle" aria-label="Next asset">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(true)} disabled={unavailable} aria-label="Expand preview">
                <Maximize2 className="h-4 w-4" />
              </Button>
              {actions}
            </div>
            <div className="relative min-h-0 flex-1">
              {unavailable ? <NeedsInfo item={item} kit={kit} /> : <FittedCanvas input={item.input} padding={item.group === "flyer" ? 24 : 32} />}
            </div>
          </>
        ) : null}
      </main>

      {expanded && item && !unavailable ? <Fullscreen item={item} onClose={() => setExpanded(false)} onStep={step} position={position} actions={actions} /> : null}
    </div>
  );
}
