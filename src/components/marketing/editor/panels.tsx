"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ColorField } from "@/components/ui/color-field";
import { cn } from "@/lib/utils";
import {
  BRAND_SOURCE_LABEL,
  DESIGN_STYLES,
  DESIGN_STYLE_META,
  LISTING_STATUS_LABEL,
  MAX_CAROUSEL_SLIDES,
  WEBSITE_SECTION_LABEL,
  type AssetRef,
  type BrandSource,
  type CarouselSlide,
  type DesignStyle,
  type ListingStatus,
  type MarketingContent,
  type MarketingOverrides,
  type SocialAssetKey,
} from "@/lib/marketing/model";
import { draftDescription } from "@/lib/marketing/defaults";
import {
  resolveCarousel,
  resolveFloorPlanIds,
  resolveGalleryIds,
  resolveHeroId,
  resolveVideoIds,
  socialFeaturedId,
  socialHeadline,
  type SocialAssetStatus,
} from "@/lib/marketing/view-model";
import type { KitApi } from "@/components/marketing/editor/use-kit";

type Group = keyof Omit<MarketingOverrides, never>;

export function useSetters(kit: KitApi) {
  const set = <G extends Group>(g: G, patch: Partial<MarketingContent[G]>) =>
    kit.update((o) => ({ ...o, [g]: { ...((o[g] as object) ?? {}), ...patch } }));
  const reset = <G extends Group>(g: G, key: keyof MarketingContent[G]) =>
    kit.update((o) => {
      const grp = o[g] as Record<string, unknown> | undefined;
      if (grp) delete grp[key as string];
      return o;
    });
  return { set, reset };
}

export function PanelSection({ title, subtitle, children, defaultOpen = false, id }: { title: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 surface-dark:hover:bg-subtle" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-heading">{title}</span>
          {subtitle ? <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="space-y-4 px-5 pb-5">{children}</div> : null}
    </section>
  );
}

export function Field({ label, hint, children, edited, onReset }: { label: string; hint?: string; children: ReactNode; edited?: boolean; onReset?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {edited && onReset ? (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-heading" title="Use the value from the project">
            <RotateCcw className="h-3 w-3" /> Use project value
          </button>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------

const STYLE_SWATCH: Record<DesignStyle, { bg: string; fg: string; font: string }> = {
  modern: { bg: "#FFFFFF", fg: "#0F172A", font: "Inter" },
  luxury: { bg: "#0B0B0C", fg: "#F4EFE6", font: "Cormorant" },
  coastal: { bg: "#F4EEE3", fg: "#21343A", font: "'DM Serif'" },
};

export function DesignPicker({ value, onChange, disabled }: { value: DesignStyle; onChange: (s: DesignStyle) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Design">
      {DESIGN_STYLES.map((s) => {
        const sw = STYLE_SWATCH[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn(
              "group overflow-hidden rounded-xl border text-left transition disabled:opacity-60",
              active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-slate-400"
            )}
          >
            <div className="flex h-16 flex-col justify-end p-2" style={{ background: sw.bg, color: sw.fg }}>
              <span className="text-lg leading-none" style={{ fontFamily: sw.font }}>
                Aa
              </span>
            </div>
            <div className="px-2 py-1.5">
              <p className="flex items-center gap-1 text-xs font-semibold text-heading">
                {DESIGN_STYLE_META[s].label}
                {active ? <Check className="h-3 w-3 text-accent" /> : null}
              </p>
              <p className="truncate text-[10px] text-muted">{DESIGN_STYLE_META[s].blurb}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property details (shared by website + social)
// ---------------------------------------------------------------------------

export function PropertyPanel({ kit }: { kit: KitApi }) {
  const { set, reset } = useSetters(kit);
  const p = kit.content.property;
  const o = kit.overrides.property ?? {};
  const ro = !kit.state.permissions.canEdit;
  const [highlight, setHighlight] = useState("");
  const addHighlight = () => {
    const h = highlight.trim();
    if (!h) return;
    set("property", { highlights: [...p.highlights, h].slice(0, 24) });
    setHighlight("");
  };
  return (
    <div className="space-y-4">
      <Field label="Address" edited={"address" in o} onReset={() => reset("property", "address")} hint="Shown on your marketing only — the project's address isn't changed.">
        <Input value={p.address} disabled={ro} onChange={(e) => set("property", { address: e.target.value })} placeholder="123 Main St" />
      </Field>
      <Field label="City, State ZIP" edited={"locality" in o} onReset={() => reset("property", "locality")}>
        <Input value={p.locality} disabled={ro} onChange={(e) => set("property", { locality: e.target.value })} placeholder="Austin, TX 78701" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Listing price" hint="Leave empty to hide the price.">
          <Input inputMode="numeric" disabled={ro} value={p.price ?? ""} onChange={(e) => set("property", { price: numOrNull(e.target.value) })} placeholder="$" />
        </Field>
        <Field label="Status">
          <select
            disabled={ro}
            value={p.status}
            onChange={(e) => set("property", { status: e.target.value as ListingStatus })}
            className="flex h-10 w-full rounded-lg border border-border bg-white px-3 text-sm surface-dark:bg-card"
          >
            {Object.entries(LISTING_STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Beds">
          <Input inputMode="decimal" disabled={ro} value={p.beds ?? ""} onChange={(e) => set("property", { beds: numOrNull(e.target.value) })} />
        </Field>
        <Field label="Baths">
          <Input inputMode="decimal" disabled={ro} value={p.baths ?? ""} onChange={(e) => set("property", { baths: numOrNull(e.target.value) })} />
        </Field>
        <Field label="Sq ft">
          <Input inputMode="numeric" disabled={ro} value={p.sqft ?? ""} onChange={(e) => set("property", { sqft: numOrNull(e.target.value) })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lot size">
          <Input disabled={ro} value={p.lotSize} onChange={(e) => set("property", { lotSize: e.target.value })} placeholder="0.25 acres" />
        </Field>
        <Field label="Year built">
          <Input inputMode="numeric" disabled={ro} value={p.yearBuilt ?? ""} onChange={(e) => set("property", { yearBuilt: numOrNull(e.target.value) })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Property type" edited={"propertyType" in o} onReset={() => reset("property", "propertyType")}>
          <Input disabled={ro} value={p.propertyType} onChange={(e) => set("property", { propertyType: e.target.value })} placeholder="Single Family Home" />
        </Field>
        <Field label="MLS #">
          <Input disabled={ro} value={p.mlsNumber} onChange={(e) => set("property", { mlsNumber: e.target.value })} />
        </Field>
      </div>
      <Field label="Listing description">
        {p.descriptionIsDraft && p.description ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Draft written from the details above — please review.
            </span>
            {!ro ? (
              <button type="button" className="font-semibold underline" onClick={() => set("property", { descriptionIsDraft: false })}>
                Confirm
              </button>
            ) : null}
          </div>
        ) : null}
        <Textarea
          rows={6}
          disabled={ro}
          value={p.description}
          onChange={(e) => set("property", { description: e.target.value, descriptionIsDraft: false })}
          placeholder="Describe what makes this home special."
        />
        {!ro ? (
          <button
            type="button"
            onClick={() => set("property", { description: draftDescription(p), descriptionIsDraft: true })}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" /> {p.description ? "Redraft from the property details" : "Draft from the property details"}
          </button>
        ) : null}
      </Field>
      <Field label="Highlights & amenities">
        <div className="flex flex-wrap gap-1.5">
          {p.highlights.map((h, i) => (
            <span key={`${h}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs surface-dark:bg-subtle">
              {h}
              {!ro ? (
                <button type="button" aria-label={`Remove ${h}`} onClick={() => set("property", { highlights: p.highlights.filter((_, j) => j !== i) })}>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {!ro ? (
          <div className="flex gap-2">
            <Input
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHighlight();
                }
              }}
              placeholder="e.g. Chef's kitchen with quartz counters"
            />
            <Button type="button" variant="outline" onClick={addHighlight} aria-label="Add highlight">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </Field>
      <OpenHouseFields kit={kit} />
    </div>
  );
}

/** Open house on/off + date and times (shared by Property details and the Open House assets). */
export function OpenHouseFields({ kit, compact }: { kit: KitApi; compact?: boolean }) {
  const { set } = useSetters(kit);
  const p = kit.content.property;
  const ro = !kit.state.permissions.canEdit;
  return (
      <div className={cn("rounded-xl border p-3", compact && !p.openHouse ? "border-amber-300 bg-amber-50/60" : "border-border")}>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Open house</Label>
          <Switch
            checked={Boolean(p.openHouse)}
            disabled={ro}
            onCheckedChange={(on) =>
              set("property", {
                openHouse: on ? { date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), start: "13:00", end: "15:00", note: "" } : null,
              })
            }
          />
        </div>
        {p.openHouse ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Input type="date" disabled={ro} value={p.openHouse.date} onChange={(e) => set("property", { openHouse: { ...p.openHouse!, date: e.target.value } })} aria-label="Open house date" />
            <Input type="time" disabled={ro} value={p.openHouse.start} onChange={(e) => set("property", { openHouse: { ...p.openHouse!, start: e.target.value } })} aria-label="Start time" />
            <Input type="time" disabled={ro} value={p.openHouse.end} onChange={(e) => set("property", { openHouse: { ...p.openHouse!, end: e.target.value } })} aria-label="End time" />
            <Input className="col-span-3" disabled={ro} value={p.openHouse.note} onChange={(e) => set("property", { openHouse: { ...p.openHouse!, note: e.target.value } })} placeholder="Note (optional), e.g. Refreshments served" />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted">Turn on to add Open House posts, stories and a website banner.</p>
        )}
      </div>
  );
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export function Thumb({ kit, id, selected, onClick, badge, dim }: { kit: KitApi; id: string; selected?: boolean; onClick?: () => void; badge?: ReactNode; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100 ring-offset-1 transition",
        selected ? "ring-2 ring-accent" : "ring-1 ring-border hover:ring-slate-400",
        dim && "opacity-40"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={kit.urls.image({ kind: "media", id }, "thumb") ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
      {badge ? <span className="absolute left-1 top-1">{badge}</span> : null}
    </button>
  );
}

export function PhotosPanel({ kit }: { kit: KitApi }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const media = kit.state.media;
  const photos = media.filter((m) => m.type === "photo");
  const videos = media.filter((m) => m.type === "video");
  const c = kit.content;
  const heroId = resolveHeroId(c, media, kit.state.coverId);
  const gallery = resolveGalleryIds(c, media);
  const floor = new Set(resolveFloorPlanIds(c, media));
  const videoIds = resolveVideoIds(c, media);
  const custom = c.media.gallery.mode === "custom";

  if (!photos.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center">
        <ImageIcon className="mx-auto h-6 w-6 text-muted" />
        <p className="mt-2 text-sm font-medium text-heading">No approved photos yet</p>
        <p className="mt-1 text-xs text-muted">Photos that clients can see on this project appear here automatically.</p>
      </div>
    );
  }

  const toggleGallery = (id: string) => {
    if (ro) return;
    if (custom) {
      const ids = c.media.gallery.mode === "custom" ? c.media.gallery.ids : [];
      set("media", { gallery: { mode: "custom", ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] } });
    } else {
      const ex = c.media.gallery.mode === "auto" ? c.media.gallery.excluded : [];
      set("media", { gallery: { mode: "auto", excluded: ex.includes(id) ? ex.filter((x) => x !== id) : [...ex, id] } });
    }
  };
  const move = (id: string, d: -1 | 1) => {
    const ids = [...gallery];
    const i = ids.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    set("media", { gallery: { mode: "custom", ids } });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-medium">Hero photo</Label>
          {c.media.heroId && !ro ? (
            <button type="button" className="text-[11px] text-muted hover:text-heading" onClick={() => set("media", { heroId: null })}>
              Use automatic pick
            </button>
          ) : (
            <span className="text-[11px] text-muted">{c.media.heroId ? "Chosen" : "Automatic (project hero image)"}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {photos.map((m) => (
            <Thumb key={m.id} kit={kit} id={m.id} selected={m.id === heroId} onClick={() => !ro && set("media", { heroId: m.id })} badge={m.id === heroId ? <Star className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow" /> : undefined} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Gallery · {gallery.length} photos</Label>
          {!ro ? (
            <button
              type="button"
              className="text-[11px] font-medium text-accent hover:underline"
              onClick={() => set("media", custom ? { gallery: { mode: "auto", excluded: [] } } : { gallery: { mode: "custom", ids: gallery } })}
            >
              {custom ? "Back to automatic" : "Choose & reorder"}
            </button>
          ) : null}
        </div>
        <p className="mb-2 text-[11px] text-muted">
          {custom ? "Tap to add or remove. Use the arrows to reorder." : "All approved photos, in project order. New photos are added automatically. Tap to leave one out."}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {photos.map((m) => {
            const included = gallery.includes(m.id);
            return (
              <div key={m.id} className="relative">
                <Thumb kit={kit} id={m.id} dim={!included} onClick={() => toggleGallery(m.id)} badge={floor.has(m.id) ? <span className="rounded bg-black/70 px-1 text-[9px] font-semibold text-white">PLAN</span> : undefined} />
                {custom && included && !ro ? (
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                    <button type="button" aria-label="Move earlier" onClick={() => move(m.id, -1)} className="rounded bg-white/90 p-0.5 shadow">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" aria-label="Move later" onClick={() => move(m.id, 1)} className="rounded bg-white/90 p-0.5 shadow">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                {custom && included ? <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{gallery.indexOf(m.id) + 1}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-medium">Floor plans</Label>
          {c.media.floorPlanIds && !ro ? (
            <button type="button" className="text-[11px] text-muted hover:text-heading" onClick={() => set("media", { floorPlanIds: null })}>
              Detect automatically
            </button>
          ) : null}
        </div>
        <p className="mb-2 text-[11px] text-muted">{floor.size ? `${floor.size} marked as floor plans.` : "None found. Tap photos to mark them as floor plans."}</p>
        <details className="text-xs">
          <summary className="cursor-pointer text-accent">Mark floor plans</summary>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {photos.map((m) => (
              <Thumb
                key={m.id}
                kit={kit}
                id={m.id}
                selected={floor.has(m.id)}
                onClick={() => {
                  if (ro) return;
                  const ids = Array.from(floor);
                  set("media", { floorPlanIds: floor.has(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id] });
                }}
              />
            ))}
          </div>
        </details>
      </div>
      {videos.length ? (
        <div>
          <Label className="text-xs font-medium">Videos</Label>
          <div className="mt-2 space-y-1.5">
            {videos.map((v) => {
              const on = videoIds.includes(v.id);
              return (
                <label key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate">{v.name || "Video"}</span>
                  <Switch
                    checked={on}
                    disabled={ro}
                    onCheckedChange={(next) => set("media", { videoIds: next ? [...videoIds, v.id] : videoIds.filter((x) => x !== v.id) })}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Website sections
// ---------------------------------------------------------------------------

export function SectionsPanel({ kit }: { kit: KitApi }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const sections = kit.content.website.sections;
  const write = (next: typeof sections) => set("website", { sections: next });
  return (
    <ul className="space-y-1.5">
      {sections.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <span className={cn("flex-1 text-sm", !s.visible && "text-muted line-through")}>{WEBSITE_SECTION_LABEL[s.key]}</span>
          <button type="button" disabled={ro || i === 0} onClick={() => { const n = [...sections]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; write(n); }} className="rounded p-1 text-muted hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${WEBSITE_SECTION_LABEL[s.key]} up`}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" disabled={ro || i === sections.length - 1} onClick={() => { const n = [...sections]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; write(n); }} className="rounded p-1 text-muted hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${WEBSITE_SECTION_LABEL[s.key]} down`}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" disabled={ro} onClick={() => write(sections.map((x) => (x.key === s.key ? { ...x, visible: !x.visible } : x)))} className="rounded p-1 text-muted hover:bg-slate-100" aria-label={s.visible ? `Hide ${WEBSITE_SECTION_LABEL[s.key]}` : `Show ${WEBSITE_SECTION_LABEL[s.key]}`}>
            {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-muted">Sections without content (for example no floor plans) hide themselves.</li>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Agent & branding
// ---------------------------------------------------------------------------

function ImageSlot({ kit, label, value, onChange, kind, allowBusinessLogo }: { kit: KitApi; label: string; value: AssetRef | null; onChange: (r: AssetRef | null) => void; kind: "logo" | "headshot"; allowBusinessLogo?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const ro = !kit.state.permissions.canEdit;
  const url = value ? kit.urls.image(value, "thumb") : null;
  const uploading = kit.busy === `upload-${kind}`;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-slate-50", kind === "headshot" ? "rounded-full" : "rounded-lg")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className={kind === "headshot" ? "h-full w-full object-cover" : "max-h-12 max-w-12 object-contain"} /> : <ImageIcon className="h-5 w-5 text-muted" />}
        </div>
        {!ro ? (
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
            </Button>
            {allowBusinessLogo && kit.state.businessLogoUrl && value?.kind !== "business_logo" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ kind: "business_logo" })}>
                Use business logo
              </Button>
            ) : null}
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const ref = await kit.upload(f, kind);
            if (ref) onChange(ref);
          }}
        />
      </div>
    </div>
  );
}

export function BrandingPanel({ kit }: { kit: KitApi }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const a = kit.content.agent;
  const b = kit.content.branding;
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium">Whose branding is this?</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 surface-dark:bg-subtle">
          {(Object.keys(BRAND_SOURCE_LABEL) as BrandSource[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={ro}
              onClick={() => set("branding", { source: s, ...(s === "business" && kit.state.businessLogoUrl ? { logo: { kind: "business_logo" } as AssetRef } : {}) })}
              className={cn("rounded-md px-2 py-1.5 text-xs font-medium", b.source === s ? "bg-white shadow-sm surface-dark:bg-card" : "text-muted")}
            >
              {BRAND_SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <ImageSlot kit={kit} label="Logo" value={b.logo} kind="logo" allowBusinessLogo onChange={(r) => set("branding", { logo: r })} />
      <div className="grid grid-cols-2 gap-3">
        <ColorField id="mk-primary" label="Primary color" value={b.primaryColor} fallback="#1F2937" onChange={(v) => /^#[0-9a-f]{6}$/i.test(v) && set("branding", { primaryColor: v })} />
        <ColorField id="mk-accent" label="Accent color" value={b.accentColor} fallback="#B08D57" onChange={(v) => /^#[0-9a-f]{6}$/i.test(v) && set("branding", { accentColor: v })} />
      </div>
      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-xs font-semibold text-heading">Listing agent</p>
        <div className="grid grid-cols-2 gap-2">
          <Input disabled={ro} value={a.name} onChange={(e) => set("agent", { name: e.target.value })} placeholder="Agent name" aria-label="Agent name" />
          <Input disabled={ro} value={a.title} onChange={(e) => set("agent", { title: e.target.value })} placeholder="Title (e.g. REALTOR®)" aria-label="Agent title" />
          <Input disabled={ro} value={a.phone} onChange={(e) => set("agent", { phone: e.target.value })} placeholder="Phone" aria-label="Agent phone" inputMode="tel" />
          <Input disabled={ro} value={a.email} onChange={(e) => set("agent", { email: e.target.value })} placeholder="Email" aria-label="Agent email" inputMode="email" />
          <Input disabled={ro} value={a.brokerage} onChange={(e) => set("agent", { brokerage: e.target.value })} placeholder="Brokerage" aria-label="Brokerage" />
          <Input disabled={ro} value={a.website} onChange={(e) => set("agent", { website: e.target.value })} placeholder="Website" aria-label="Agent website" />
          <Input disabled={ro} className="col-span-2" value={a.license} onChange={(e) => set("agent", { license: e.target.value })} placeholder="License # (optional)" aria-label="License number" />
        </div>
        <ImageSlot kit={kit} label="Agent headshot" value={a.headshot} kind="headshot" onChange={(r) => set("agent", { headshot: r })} />
        <ImageSlot kit={kit} label="Brokerage logo" value={a.brokerageLogo} kind="logo" onChange={(r) => set("agent", { brokerageLogo: r })} />
      </div>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-heading">Unbranded version</span>
          <span className="block text-[11px] text-muted">Hide agent and brokerage details (for MLS-style unbranded links). Check your MLS rules.</span>
        </span>
        <Switch checked={b.unbranded} disabled={ro} onCheckedChange={(v) => set("branding", { unbranded: v })} />
      </label>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-heading">Photography credit</span>
          <span className="block text-[11px] text-muted">“Photography by {kit.state.businessName || "your photographer"}” in the footer and flyer.</span>
        </span>
        <Switch checked={b.photographerCredit} disabled={ro} onCheckedChange={(v) => set("branding", { photographerCredit: v })} />
      </label>
      {!ro ? (
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={kit.busy === "save_brand_profile"} onClick={() => void kit.action("save_brand_profile", {}, "Saved — this realtor's next listing will start with this branding.")}>
          {kit.busy === "save_brand_profile" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />} Save as this realtor&apos;s default branding
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social assets
// ---------------------------------------------------------------------------

export function SocialAssetsPanel({ kit, statuses, selected, onSelect }: { kit: KitApi; statuses: SocialAssetStatus[]; selected: string; onSelect: (id: string) => void }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const disabled = kit.content.social.disabled;
  const groups: [string, SocialAssetStatus["format"]][] = [
    ["Square posts", "square"],
    ["Stories", "story"],
    ["Property flyer", "flyer"],
  ];
  return (
    <div className="space-y-4">
      {groups.map(([title, fmt]) => (
        <div key={fmt}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
          <ul className="space-y-1">
            {statuses
              .filter((s) => s.format === fmt)
              .map((s) => (
                <li key={s.key} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", selected === s.key ? "border-accent bg-accent/5" : "border-border")}>
                  <button type="button" onClick={() => onSelect(s.key)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block truncate text-sm", (!s.available || !s.enabled) && "text-muted")}>{s.label}</span>
                    {s.reason ? <span className="block truncate text-[11px] text-amber-700">{s.reason}</span> : null}
                  </button>
                  <Switch
                    checked={s.enabled && s.available}
                    disabled={ro || !s.available}
                    aria-label={`Include ${s.label}`}
                    onCheckedChange={(on) => set("social", { disabled: on ? disabled.filter((k) => k !== s.key) : [...disabled, s.key] })}
                  />
                </li>
              ))}
          </ul>
        </div>
      ))}
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="text-sm">Instagram carousel</span>
        <Switch checked={kit.content.social.includeCarousel} disabled={ro} onCheckedChange={(v) => set("social", { includeCarousel: v })} />
      </label>
    </div>
  );
}
