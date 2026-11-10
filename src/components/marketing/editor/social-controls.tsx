"use client";

/**
 * Asset-specific controls for the Social Media Kit workspace (middle column). Global settings
 * — design, property details, branding — stay in the left column; everything here changes
 * only the selected asset.
 */
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Field, OpenHouseFields, Thumb, useSetters } from "@/components/marketing/editor/panels";
import type { KitApi } from "@/components/marketing/editor/use-kit";
import {
  FLYER_LAYOUTS,
  MAX_CAROUSEL_SLIDES,
  MAX_FLYER_PHOTOS,
  SOCIAL_ASSETS,
  type CarouselSlide,
  type FlyerConfig,
  type FlyerLayout,
  type SocialAssetKey,
} from "@/lib/marketing/model";
import { flyerConfig, resolveCarousel, resolveFlyerPhotoIds, resolveHeroId, socialFeaturedId, socialHeadline } from "@/lib/marketing/view-model";

export function ControlGroup({ title, hint, action, children }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
        {action}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted">{hint}</p> : null}
    </section>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
      {children}
    </button>
  );
}

function PhotoPicker({ kit, selected, onPick, numbered }: { kit: KitApi; selected: string[]; onPick: (id: string) => void; numbered?: boolean }) {
  const ro = !kit.state.permissions.canEdit;
  const photos = kit.state.media.filter((m) => m.type === "photo");
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {photos.map((m) => {
        const i = selected.indexOf(m.id);
        return (
          <div key={m.id} className="relative">
            <Thumb kit={kit} id={m.id} selected={i >= 0} onClick={() => !ro && onPick(m.id)} />
            {numbered && i >= 0 ? (
              <span className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{i + 1}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function IncludeSwitch({ kit, label, checked, disabled, onChange }: { kit: KitApi; label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium text-heading">{label}</span>
        <span className="block text-[11px] text-muted">{checked ? "Included in Download Kit (ZIP)" : "Left out of the Download Kit"}</span>
      </span>
      <Switch checked={checked} disabled={disabled || !kit.state.permissions.canEdit} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Square posts and stories
// ---------------------------------------------------------------------------

export function AssetControls({ kit, assetKey }: { kit: KitApi; assetKey: SocialAssetKey }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const c = kit.content;
  const media = kit.state.media;
  const meta = SOCIAL_ASSETS.find((a) => a.key === assetKey)!;
  const heroId = resolveHeroId(c, media, kit.state.coverId);
  const featured = socialFeaturedId(assetKey, c, media, heroId);
  const disabled = c.social.disabled;
  const usesHighlights = assetKey === "sq_highlights";
  return (
    <div className="space-y-6">
      {meta.requires === "openHouse" ? (
        <ControlGroup title="Open house" hint="Shared with the website banner and every Open House graphic.">
          <OpenHouseFields kit={kit} compact />
        </ControlGroup>
      ) : null}
      <ControlGroup title="Headline">
        <Field label="Text" hint="Up to 40 characters. Leave empty for the default.">
          <Input
            disabled={ro}
            maxLength={40}
            value={c.social.headlines[assetKey] ?? ""}
            placeholder={socialHeadline(assetKey, { ...c, social: { ...c.social, headlines: {} } })}
            onChange={(e) => set("social", { headlines: { ...c.social.headlines, [assetKey]: e.target.value } })}
          />
        </Field>
      </ControlGroup>
      <ControlGroup
        title={usesHighlights ? "Photo" : "Featured photo"}
        action={
          c.social.featured[assetKey] && !ro ? (
            <LinkButton
              onClick={() => {
                const f = { ...c.social.featured };
                delete f[assetKey];
                set("social", { featured: f });
              }}
            >
              <RotateCcw className="h-3 w-3" /> Automatic
            </LinkButton>
          ) : (
            <span className="text-[11px] text-muted">{c.social.featured[assetKey] ? "Chosen" : "Automatic"}</span>
          )
        }
      >
        <PhotoPicker kit={kit} selected={featured ? [featured] : []} onPick={(id) => set("social", { featured: { ...c.social.featured, [assetKey]: id } })} />
      </ControlGroup>
      {usesHighlights || assetKey === "st_details" ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted surface-dark:bg-subtle">
          Highlights and facts come from <strong className="font-semibold text-heading">Property details</strong> in the left column.
        </p>
      ) : null}
      <IncludeSwitch
        kit={kit}
        label="Include this graphic"
        checked={!disabled.includes(assetKey)}
        onChange={(on) => set("social", { disabled: on ? disabled.filter((k) => k !== assetKey) : [...disabled, assetKey] })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram carousel
// ---------------------------------------------------------------------------

const SLIDE_KIND: Record<CarouselSlide["kind"], string> = { cover: "Cover", photo: "Photo", highlights: "Highlights", agent: "Agent contact" };

export function CarouselControls({ kit, index, onSelectIndex }: { kit: KitApi; index: number; onSelectIndex: (i: number) => void }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const c = kit.content;
  const media = kit.state.media;
  const heroId = resolveHeroId(c, media, kit.state.coverId);
  const slides = resolveCarousel(c, media, heroId);
  const photos = media.filter((m) => m.type === "photo");
  const i = Math.min(index, slides.length - 1);
  const slide = slides[i];
  const write = (next: CarouselSlide[]) => set("social", { carousel: next.slice(0, MAX_CAROUSEL_SLIDES) });
  const move = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const n = [...slides];
    [n[i], n[j]] = [n[j]!, n[i]!];
    write(n);
    onSelectIndex(j);
  };
  const add = (s: CarouselSlide) => {
    write([...slides, s]);
    onSelectIndex(slides.length);
  };
  if (!slide) return null;
  return (
    <div className="space-y-6">
      <ControlGroup title={`Slide ${i + 1} of ${slides.length}`} action={<span className="text-[11px] font-medium text-heading">{SLIDE_KIND[slide.kind]}</span>}>
        {!ro ? (
          <div className="grid grid-cols-3 gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => move(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Earlier
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={i === slides.length - 1} onClick={() => move(1)}>
              Later <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={slides.length <= 1}
              onClick={() => {
                write(slides.filter((_, j) => j !== i));
                onSelectIndex(Math.max(0, i - 1));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        ) : null}
      </ControlGroup>

      {slide.kind === "photo" ? (
        <ControlGroup title="Caption">
          <Input
            disabled={ro}
            value={slide.caption}
            maxLength={40}
            placeholder="Optional, e.g. Kitchen"
            onChange={(e) => write(slides.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
          />
        </ControlGroup>
      ) : null}
      {slide.kind === "photo" || slide.kind === "cover" ? (
        <ControlGroup title={slide.kind === "cover" ? "Cover photo" : "Slide photo"}>
          <PhotoPicker
            kit={kit}
            selected={[slide.mediaId ?? (slide.kind === "cover" ? heroId : null)].filter((x): x is string => Boolean(x))}
            onPick={(id) => write(slides.map((x, j) => (j === i ? { ...x, mediaId: id } : x)))}
          />
        </ControlGroup>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted surface-dark:bg-subtle">
          {slide.kind === "highlights" ? "This slide lists the highlights from Property details." : "This slide uses the agent details from Agent & branding."} Edit them in the left column.
        </p>
      )}

      {!ro ? (
        <ControlGroup
          title="Slides"
          hint={`${slides.length} of ${MAX_CAROUSEL_SLIDES} slides · ${c.social.carousel ? "custom order" : "automatic"}`}
          action={c.social.carousel ? <LinkButton onClick={() => { set("social", { carousel: null }); onSelectIndex(0); }}><RotateCcw className="h-3 w-3" /> Reset to automatic</LinkButton> : null}
        >
          {slides.length < MAX_CAROUSEL_SLIDES ? (
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => add({ kind: "photo", mediaId: photos.find((p) => !slides.some((s) => s.mediaId === p.id))?.id ?? photos[0]?.id ?? null, caption: "" })}>
                <Plus className="h-3.5 w-3.5" /> Photo slide
              </Button>
              {!slides.some((s) => s.kind === "highlights") ? (
                <Button type="button" size="sm" variant="outline" onClick={() => add({ kind: "highlights", mediaId: null, caption: "" })}>
                  <Plus className="h-3.5 w-3.5" /> Highlights
                </Button>
              ) : null}
              {!slides.some((s) => s.kind === "agent") ? (
                <Button type="button" size="sm" variant="outline" onClick={() => add({ kind: "agent", mediaId: null, caption: "" })}>
                  <Plus className="h-3.5 w-3.5" /> Agent slide
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-muted">Instagram allows up to {MAX_CAROUSEL_SLIDES} slides.</p>
          )}
        </ControlGroup>
      ) : null}

      <IncludeSwitch kit={kit} label="Include the carousel" checked={c.social.includeCarousel} onChange={(v) => set("social", { includeCarousel: v })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property flyer
// ---------------------------------------------------------------------------

function LayoutSketch({ layout }: { layout: FlyerLayout }) {
  const box = "rounded-[2px] bg-slate-300 surface-dark:bg-slate-600";
  const line = "h-[3px] rounded-full bg-slate-300 surface-dark:bg-slate-600";
  return (
    <div className="flex h-[74px] w-[57px] flex-col gap-[3px] rounded-[3px] border border-border bg-white p-[3px] surface-dark:bg-card">
      {layout === "gallery" ? (
        <>
          <div className={cn(box, "h-6 bg-slate-400")} />
          <div className="grid flex-1 grid-cols-4 gap-[2px]">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className={box} />)}
          </div>
          <div className={cn(line, "w-3/4")} />
        </>
      ) : layout === "showcase" ? (
        <>
          <div className={cn(box, "h-6 bg-slate-400")} />
          <div className="flex flex-1 gap-[3px]">
            <div className="flex w-[18px] flex-col gap-[3px] pt-[1px]">
              <div className={line} />
              <div className={cn(line, "w-2/3")} />
              <div className={line} />
              <div className={cn(line, "w-3/4")} />
            </div>
            <div className="flex flex-1 flex-col gap-[2px]">
              <div className={cn(box, "h-[14px]")} />
              <div className="grid flex-1 grid-cols-2 gap-[2px]">
                {Array.from({ length: 4 }, (_, i) => <div key={i} className={box} />)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={cn(box, "h-6 bg-slate-400")} />
          <div className={cn(line, "w-2/3")} />
          <div className="grid flex-1 grid-cols-3 gap-[2px]">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className={box} />)}
          </div>
          <div className={cn(line, "w-3/4")} />
        </>
      )}
      <div className="h-[6px] rounded-[1px] bg-slate-200 surface-dark:bg-slate-700" />
    </div>
  );
}

export function FlyerLayoutPicker({ kit }: { kit: KitApi }) {
  const { set } = useSetters(kit);
  const cfg = flyerConfig(kit.content);
  const ro = !kit.state.permissions.canEdit;
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Flyer layout">
      {FLYER_LAYOUTS.map((l) => {
        const active = cfg.layout === l.key;
        return (
          <button
            key={l.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={ro}
            onClick={() => set("social", { flyer: { ...cfg, layout: l.key } })}
            className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition disabled:opacity-60", active ? "border-accent bg-accent/5 ring-2 ring-accent/25" : "border-border hover:border-slate-400")}
          >
            <LayoutSketch layout={l.key} />
            <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight text-heading">
              {l.label}
              {active ? <Check className="h-3 w-3 text-accent" /> : null}
            </span>
            <span className="text-[10px] leading-tight text-muted">{l.photos} photos</span>
          </button>
        );
      })}
    </div>
  );
}

export function FlyerControls({ kit }: { kit: KitApi }) {
  const { set } = useSetters(kit);
  const ro = !kit.state.permissions.canEdit;
  const c = kit.content;
  const media = kit.state.media;
  const cfg = flyerConfig(c);
  const layout = FLYER_LAYOUTS.find((l) => l.key === cfg.layout)!;
  const heroId = resolveHeroId(c, media, kit.state.coverId);
  const cover = socialFeaturedId("flyer", c, media, heroId);
  const chosen = resolveFlyerPhotoIds(c, media, kit.state.coverId);
  const setFlyer = (patch: Partial<FlyerConfig>) => set("social", { flyer: { ...cfg, ...patch } });
  const published = kit.state.website.status === "published";
  const disabled = c.social.disabled;

  const togglePhoto = (id: string) => {
    if (id === cover) return;
    const current = cfg.photoIds ?? chosen;
    const next = current.includes(id) ? current.filter((x) => x !== id) : current.length < MAX_FLYER_PHOTOS ? [...current, id] : current;
    setFlyer({ photoIds: next });
  };

  const sections: { key: keyof Pick<FlyerConfig, "showAgent" | "showHighlights" | "showDescription" | "showQr">; label: string; hint: string }[] = [
    { key: "showAgent", label: "Agent information", hint: kit.content.branding.unbranded ? "Hidden — the kit is set to unbranded." : "Name, contact details, headshot and brokerage." },
    { key: "showHighlights", label: "Property highlights", hint: c.property.highlights.length ? `${c.property.highlights.length} from Property details.` : "Add highlights in Property details." },
    { key: "showDescription", label: "Description", hint: c.property.description ? "From Property details, trimmed to fit." : "Add a description in Property details." },
    { key: "showQr", label: "QR code to the website", hint: published ? "Links to the published property website." : "Appears once the property website is published." },
  ];

  return (
    <div className="space-y-6">
      <ControlGroup title="Layout" hint={layout.blurb + "."}>
        <FlyerLayoutPicker kit={kit} />
      </ControlGroup>
      <ControlGroup
        title="Cover photo"
        action={
          c.social.featured.flyer && !ro ? (
            <LinkButton
              onClick={() => {
                const f = { ...c.social.featured };
                delete f.flyer;
                set("social", { featured: f });
              }}
            >
              <RotateCcw className="h-3 w-3" /> Automatic
            </LinkButton>
          ) : null
        }
      >
        <PhotoPicker kit={kit} selected={cover ? [cover] : []} onPick={(id) => set("social", { featured: { ...c.social.featured, flyer: id } })} />
      </ControlGroup>
      <ControlGroup
        title={`Photos · ${chosen.length} of ${layout.photos}`}
        hint={
          cfg.photoIds
            ? `Tap to add or remove. The first ${layout.photos} in order are used by this layout.`
            : "Picked automatically from different rooms. Tap any photo to choose your own."
        }
        action={cfg.photoIds && !ro ? <LinkButton onClick={() => setFlyer({ photoIds: null })}><RotateCcw className="h-3 w-3" /> Automatic</LinkButton> : null}
      >
        <PhotoPicker kit={kit} selected={chosen} numbered onPick={togglePhoto} />
      </ControlGroup>
      <ControlGroup title="Show on the flyer">
        <div className="divide-y divide-border rounded-lg border border-border">
          {sections.map((sec) => (
            <label key={sec.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-heading">{sec.label}</span>
                <span className="block text-[11px] text-muted">{sec.hint}</span>
              </span>
              <Switch checked={cfg[sec.key]} disabled={ro} onCheckedChange={(v) => setFlyer({ [sec.key]: v })} aria-label={sec.label} />
            </label>
          ))}
        </div>
      </ControlGroup>
      <ControlGroup title="Headline">
        <Input
          disabled={ro}
          maxLength={40}
          value={c.social.headlines.flyer ?? ""}
          placeholder={socialHeadline("flyer", { ...c, social: { ...c.social, headlines: {} } })}
          onChange={(e) => set("social", { headlines: { ...c.social.headlines, flyer: e.target.value } })}
          aria-label="Flyer headline"
        />
      </ControlGroup>
      <IncludeSwitch
        kit={kit}
        label="Include the flyer"
        checked={!disabled.includes("flyer")}
        onChange={(on) => set("social", { disabled: on ? disabled.filter((k) => k !== "flyer") : [...disabled, "flyer"] })}
      />
    </div>
  );
}
