"use client";

/**
 * Property website — Modern, Luxury and Coastal templates.
 *
 * Responsive with CONTAINER queries (@container / @3xl: / @5xl:), not viewport media
 * queries, so the identical markup renders the public site and the editor's desktop/mobile
 * preview frames. Sections render in the user's order and hide themselves when the
 * underlying facts or media are missing — nothing is invented to fill a layout.
 */
import { TourViewer } from "@/components/tours/tour-viewer";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PoweredByShootPortal } from "@/components/website/powered-by";
import { Bath, BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, Globe, Mail, Maximize2, Phone, Ruler, X } from "lucide-react";
import { LISTING_STATUS_LABEL, type DesignStyle, type WebsiteSectionKey } from "@/lib/marketing/model";
import type { ListingView, ViewImage } from "@/lib/marketing/view-model";

type Skin = {
  root: string;
  font: { head: string; body: string };
  headWeight: number;
  label: string;
  section: string;
  sectionAlt: string;
  heading: string;
  muted: string;
  card: string;
  rule: string;
  imgRadius: string;
};

const SKINS: Record<DesignStyle, Skin> = {
  modern: {
    root: "bg-white text-slate-900",
    font: { head: "Inter, ui-sans-serif, system-ui", body: "Inter, ui-sans-serif, system-ui" },
    headWeight: 700,
    label: "text-[11px] font-semibold uppercase tracking-[0.22em]",
    section: "bg-white",
    sectionAlt: "bg-slate-50",
    heading: "text-3xl @3xl:text-4xl tracking-tight",
    muted: "text-slate-500",
    card: "bg-white ring-1 ring-slate-200 rounded-2xl",
    rule: "border-slate-200",
    imgRadius: "rounded-xl",
  },
  luxury: {
    root: "bg-[#0B0B0C] text-[#F4EFE6]",
    font: { head: "Cormorant, 'Cormorant Garamond', Georgia, serif", body: "Inter, ui-sans-serif, system-ui" },
    headWeight: 500,
    label: "text-[11px] uppercase tracking-[0.42em]",
    section: "bg-[#0B0B0C]",
    sectionAlt: "bg-[#121214]",
    heading: "text-4xl @3xl:text-6xl",
    muted: "text-[#B7AFA2]",
    card: "bg-[#141416] ring-1 ring-white/10",
    rule: "border-white/15",
    imgRadius: "rounded-none",
  },
  coastal: {
    root: "bg-[#F7F2EA] text-[#21343A]",
    font: { head: "'DM Serif', 'DM Serif Display', Georgia, serif", body: "'Nunito Sans', ui-sans-serif, system-ui" },
    headWeight: 400,
    label: "text-xs font-bold uppercase tracking-[0.2em]",
    section: "bg-[#F7F2EA]",
    sectionAlt: "bg-[#EFE7DA]",
    heading: "text-4xl @3xl:text-5xl",
    muted: "text-[#5C6D71]",
    card: "bg-white/80 ring-1 ring-black/5 rounded-[28px]",
    rule: "border-[#21343A]/15",
    imgRadius: "rounded-[24px]",
  },
};

export type ListingWebsiteProps = {
  view: ListingView;
  /** Editor preview: no fixed-position overlays, links don't navigate away. */
  preview?: boolean;
  /** Shown on locked (unpurchased) previews. */
  previewRibbon?: string | null;
};

function H({ skin, children, className = "" }: { skin: Skin; children: ReactNode; className?: string }) {
  return (
    <h2 className={`${skin.heading} ${className}`} style={{ fontFamily: skin.font.head, fontWeight: skin.headWeight, lineHeight: 1.08 }}>
      {children}
    </h2>
  );
}

function Label({ skin, children, accent }: { skin: Skin; children: ReactNode; accent?: boolean }) {
  return (
    <p className={skin.label} style={accent ? { color: "var(--mk-accent)" } : undefined}>
      {children}
    </p>
  );
}

function Img({ img, className, sizes, eager }: { img: ViewImage; className?: string; sizes?: string; eager?: boolean }) {
  return (
    // Images come from the authorized marketing image route (redirect to a short-lived,
    // size-capped signed URL), so next/image's optimizer isn't used here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt={img.alt || "Property photo"}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      sizes={sizes}
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

function factIcon(label: string) {
  if (/bed/i.test(label)) return BedDouble;
  if (/bath/i.test(label)) return Bath;
  if (/sq/i.test(label)) return Maximize2;
  if (/lot/i.test(label)) return Ruler;
  return CalendarDays;
}

function Hero({ view, skin, style }: { view: ListingView; skin: Skin; style: DesignStyle }) {
  const status = LISTING_STATUS_LABEL[view.property.status];
  if (style === "coastal") {
    return (
      <section className="px-4 pt-4 @3xl:px-8 @3xl:pt-8">
        <div className="relative overflow-hidden rounded-[32px] aspect-[4/5] @xl:aspect-[16/10] @5xl:aspect-[21/9]">
          {view.hero ? <Img img={view.hero} eager sizes="100vw" /> : <div className="h-full w-full bg-[#DCCFBC]" />}
          <span className="absolute left-5 top-5 rounded-full bg-[#F7F2EA]/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--mk-accent)" }}>
            {status}
          </span>
        </div>
        <div className="mx-auto -mt-16 max-w-4xl px-2 @3xl:-mt-24">
          <div className="relative rounded-[28px] bg-[#F7F2EA] px-6 py-7 shadow-[0_20px_60px_rgba(33,52,58,0.12)] @3xl:px-10 @3xl:py-9">
            <h1 className="text-4xl @3xl:text-6xl" style={{ fontFamily: skin.font.head, lineHeight: 1.04 }}>
              {view.property.address || "Your listing"}
            </h1>
            {view.property.locality ? <p className={`mt-2 text-lg ${skin.muted}`}>{view.property.locality}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              {view.priceText ? (
                <p className="text-2xl font-bold @3xl:text-3xl" style={{ color: "var(--mk-accent)" }}>
                  {view.priceText}
                </p>
              ) : null}
              {view.facts.slice(0, 3).map((f) => (
                <p key={f.label} className={`text-base ${skin.muted}`}>
                  <span className="font-bold text-[#21343A]">{f.value}</span> {f.label}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  if (style === "luxury") {
    return (
      <section className="relative">
        <div className="relative aspect-[4/5] @xl:aspect-[16/10] @5xl:aspect-[21/9]">
          {view.hero ? <Img img={view.hero} eager sizes="100vw" /> : <div className="h-full w-full bg-[#1B1B1E]" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/85" />
          <div className="absolute inset-4 border border-white/30 @3xl:inset-8" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-12 text-center @3xl:pb-20">
            <div className="flex items-center gap-4">
              <span className="h-px w-10 bg-[var(--mk-accent)]" />
              <Label skin={skin} accent>
                {status}
              </Label>
              <span className="h-px w-10 bg-[var(--mk-accent)]" />
            </div>
            <h1 className="mt-4 text-5xl text-white @3xl:text-7xl @5xl:text-8xl" style={{ fontFamily: skin.font.head, fontWeight: 500, lineHeight: 1 }}>
              {view.property.address || "Your listing"}
            </h1>
            {view.property.locality ? <p className="mt-4 text-xs uppercase tracking-[0.4em] text-white/75 @3xl:text-sm">{view.property.locality}</p> : null}
            {view.priceText ? (
              <p className="mt-5 text-3xl text-white @3xl:text-4xl" style={{ fontFamily: skin.font.head }}>
                {view.priceText}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="relative">
      <div className="relative aspect-[4/5] @xl:aspect-[16/10] @5xl:aspect-[21/9]">
        {view.hero ? <Img img={view.hero} eager sizes="100vw" /> : <div className="h-full w-full bg-slate-200" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl flex-col gap-3 px-5 pb-8 text-white @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:px-10 @3xl:pb-12">
          <div className="min-w-0">
            <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ background: "var(--mk-accent)", color: "var(--mk-on-accent)" }}>
              {status}
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight @3xl:text-6xl" style={{ lineHeight: 1.02 }}>
              {view.property.address || "Your listing"}
            </h1>
            {view.property.locality ? <p className="mt-2 text-lg text-white/85">{view.property.locality}</p> : null}
          </div>
          {view.priceText ? <p className="shrink-0 text-3xl font-bold @3xl:text-5xl">{view.priceText}</p> : null}
        </div>
      </div>
    </section>
  );
}

function Facts({ view, skin, style }: { view: ListingView; skin: Skin; style: DesignStyle }) {
  if (!view.facts.length && !view.property.propertyType) return null;
  if (style === "luxury") {
    return (
      <section className={`${skin.section} border-y ${skin.rule}`}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 @3xl:flex @3xl:justify-center">
          {view.facts.map((f, i) => (
            <div key={f.label} className={`flex flex-col items-center px-8 py-8 @3xl:py-10 ${i ? `@3xl:border-l ${skin.rule}` : ""}`}>
              <span className="text-4xl @3xl:text-5xl" style={{ fontFamily: skin.font.head }}>
                {f.value}
              </span>
              <span className={`mt-2 ${skin.label} ${skin.muted}`}>{f.label}</span>
            </div>
          ))}
          {view.property.propertyType ? (
            <div className={`col-span-2 flex flex-col items-center px-8 py-8 @3xl:col-span-1 @3xl:border-l @3xl:py-10 ${skin.rule}`}>
              <span className="text-2xl @3xl:text-3xl" style={{ fontFamily: skin.font.head }}>
                {view.property.propertyType}
              </span>
              <span className={`mt-2 ${skin.label} ${skin.muted}`}>Type</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <section className={`${style === "coastal" ? skin.section : skin.section} px-5 py-8 @3xl:px-10 ${style === "coastal" ? "pt-10" : ""}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-6">
        {view.facts.map((f) => {
          const Icon = factIcon(f.label);
          return (
            <div key={f.label} className={`${skin.card} flex items-center gap-3 px-4 py-4`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--mk-accent) 14%, transparent)", color: "var(--mk-accent)" }}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{f.value}</p>
                <p className={`text-xs uppercase tracking-wider ${skin.muted}`}>{f.label}</p>
              </div>
            </div>
          );
        })}
        {view.property.propertyType ? (
          <div className={`${skin.card} flex items-center px-4 py-4`}>
            <div>
              <p className="text-base font-bold leading-tight">{view.property.propertyType}</p>
              <p className={`text-xs uppercase tracking-wider ${skin.muted}`}>Type</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Description({ view, skin }: { view: ListingView; skin: Skin }) {
  const text = view.property.description.trim();
  if (!text) return null;
  return (
    <section className={`${skin.section} px-5 py-14 @3xl:px-10 @3xl:py-20`}>
      <div className="mx-auto grid max-w-6xl gap-6 @4xl:grid-cols-[1fr_1.6fr] @4xl:gap-16">
        <div>
          <Label skin={skin} accent>
            About the home
          </Label>
          <H skin={skin} className="mt-3">
            A closer look
          </H>
        </div>
        <div className={`space-y-4 text-[17px] leading-8 ${skin.muted}`}>
          {text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
          {view.property.mlsNumber ? <p className="text-xs uppercase tracking-wider">MLS# {view.property.mlsNumber}</p> : null}
        </div>
      </div>
    </section>
  );
}

function Highlights({ view, skin, style }: { view: ListingView; skin: Skin; style: DesignStyle }) {
  if (!view.property.highlights.length) return null;
  return (
    <section className={`${skin.sectionAlt} px-5 py-14 @3xl:px-10 @3xl:py-20`}>
      <div className="mx-auto max-w-6xl">
        <Label skin={skin} accent>
          Highlights
        </Label>
        <H skin={skin} className="mt-3">
          Features &amp; amenities
        </H>
        <ul className="mt-8 grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
          {view.property.highlights.map((h, i) => (
            <li key={i} className={`${style === "luxury" ? `border-b ${skin.rule} py-4` : `${skin.card} px-5 py-4`} flex items-start gap-3`}>
              <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--mk-accent)" }} />
              <span className="text-[16px] leading-6">{h}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Photos shown before "View all photos": one large + eight small fills three full rows. */
const GALLERY_PREVIEW_COUNT = 9;

function Gallery({ view, skin, style, onOpen }: { view: ListingView; skin: Skin; style: DesignStyle; onOpen: (i: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!view.gallery.length) return null;
  const total = view.gallery.length;
  const collapsed = !expanded && total > GALLERY_PREVIEW_COUNT;
  const [first, ...rest] = collapsed ? view.gallery.slice(0, GALLERY_PREVIEW_COUNT) : view.gallery;
  const gap = style === "luxury" ? "gap-2 @3xl:gap-3" : "gap-3";
  const btn =
    style === "luxury"
      ? "border border-[var(--mk-accent)] px-7 py-3.5 text-xs uppercase tracking-[0.3em] hover:bg-[var(--mk-accent)] hover:text-black"
      : "rounded-full px-7 py-3.5 text-sm font-semibold ring-1 ring-current/20 hover:ring-current/40";
  return (
    <section id="gallery" className={`${skin.section} px-3 py-14 @3xl:px-8 @3xl:py-20`}>
      <div className="mx-auto max-w-7xl">
        <div className="px-2 @3xl:px-2">
          <Label skin={skin} accent>
            Gallery
          </Label>
          <H skin={skin} className="mt-3">
            {view.gallery.length} photos
          </H>
        </div>
        <div className={`mt-8 grid grid-cols-2 ${gap} @3xl:grid-cols-4`}>
          {first ? (
            <button type="button" onClick={() => onOpen(0)} className={`group col-span-2 row-span-2 overflow-hidden ${skin.imgRadius} aspect-[4/3] @3xl:aspect-auto`}>
              <Img img={first} className="transition-transform duration-500 group-hover:scale-[1.03]" sizes="(min-width: 1024px) 50vw, 100vw" />
            </button>
          ) : null}
          {rest.map((img, i) => (
            <button key={img.id} type="button" onClick={() => onOpen(i + 1)} className={`group overflow-hidden ${skin.imgRadius} aspect-[4/3]`}>
              <Img img={{ ...img, url: img.url }} className="transition-transform duration-500 group-hover:scale-[1.04]" sizes="(min-width: 1024px) 25vw, 50vw" />
            </button>
          ))}
        </div>
        {total > GALLERY_PREVIEW_COUNT ? (
          <div className="mt-10 flex justify-center">
            <button type="button" onClick={(e) => {
                if (expanded) e.currentTarget.closest("section")?.scrollIntoView({ block: "start" });
                setExpanded(!expanded);
              }} aria-expanded={expanded} className={`inline-flex items-center gap-2 transition ${btn}`}>
              {expanded ? "Show fewer photos" : `View all ${total} photos`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Videos({ view, skin }: { view: ListingView; skin: Skin }) {
  if (!view.videos.length) return null;
  return (
    <section className={`${skin.sectionAlt} px-4 py-14 @3xl:px-10 @3xl:py-20`}>
      <div className="mx-auto max-w-6xl">
        <Label skin={skin} accent>
          Video
        </Label>
        <H skin={skin} className="mt-3">
          Take the tour
        </H>
        <div className="mt-8 space-y-6">
          {view.videos.map((v) => (
            <div key={v.id} className={`overflow-hidden ${skin.imgRadius} bg-black aspect-video`}>
              {v.kind === "youtube" && v.embedUrl ? (
                <iframe src={v.embedUrl} title={v.title} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" />
              ) : v.src ? (
                <video src={v.src} poster={v.posterUrl ?? undefined} controls playsInline preload="none" className="h-full w-full object-contain" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FloorPlans({ view, skin }: { view: ListingView; skin: Skin }) {
  if (!view.floorPlans.length) return null;
  return (
    <section className={`${skin.section} px-5 py-14 @3xl:px-10 @3xl:py-20`}>
      <div className="mx-auto max-w-6xl">
        <Label skin={skin} accent>
          Floor plans
        </Label>
        <H skin={skin} className="mt-3">
          The layout
        </H>
        <div className="mt-8 grid gap-6 @3xl:grid-cols-2">
          {view.floorPlans.map((fp) => (
            <a key={fp.id} href={fp.url} target="_blank" rel="noopener noreferrer" className={`block overflow-hidden bg-white p-4 ${skin.imgRadius} ring-1 ring-black/5`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fp.url} alt={fp.alt || "Floor plan"} loading="lazy" className="mx-auto max-h-[640px] w-full object-contain" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tours({ view, skin }: { view: ListingView; skin: Skin }) {
  if (!view.tours.length) return null;
  return (
    <section className={`${skin.sectionAlt} px-4 py-14 @3xl:px-10 @3xl:py-20`}>
      <div className="mx-auto max-w-6xl">
        <Label skin={skin} accent>
          Virtual tour
        </Label>
        <H skin={skin} className="mt-3">
          Walk through in 360°
        </H>
        <div className="mt-8 space-y-6">
          {view.tours.map((t) => (
            <TourViewer
              key={t.id}
              title={t.title}
              url={t.url}
              embedUrl={t.embedUrl}
              thumbnailUrl={t.thumbnailUrl}
              className={skin.imgRadius}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function OpenHouse({ view, skin, style }: { view: ListingView; skin: Skin; style: DesignStyle }) {
  if (!view.openHouse) return null;
  return (
    <section className="px-4 py-10 @3xl:px-10">
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:px-10 ${style === "coastal" ? "rounded-[28px]" : style === "modern" ? "rounded-2xl" : "border border-[var(--mk-accent)]"}`}
        style={style === "luxury" ? undefined : { background: "var(--mk-primary)", color: "var(--mk-on-primary)" }}
      >
        <div>
          <Label skin={skin} accent={style === "luxury"}>
            Open house
          </Label>
          <p className="mt-2 text-3xl @3xl:text-4xl" style={{ fontFamily: skin.font.head, fontWeight: skin.headWeight }}>
            {view.openHouse.day}
          </p>
          {view.openHouse.note ? <p className="mt-1 text-sm opacity-80">{view.openHouse.note}</p> : null}
        </div>
        <p className="text-2xl font-semibold @3xl:text-3xl">{view.openHouse.time}</p>
      </div>
    </section>
  );
}

function Agent({ view, skin, style, preview }: { view: ListingView; skin: Skin; style: DesignStyle; preview?: boolean }) {
  if (!view.showAgent) return null;
  const a = view.agent;
  const website = a.website ? (/^https?:\/\//i.test(a.website) ? a.website : `https://${a.website}`) : null;
  const btn =
    style === "luxury"
      ? "border border-[var(--mk-accent)] px-5 py-3 text-xs uppercase tracking-[0.3em] hover:bg-[var(--mk-accent)] hover:text-black"
      : `rounded-full px-5 py-3 text-sm font-semibold ${style === "coastal" ? "" : ""}`;
  const solid = style === "luxury" ? undefined : { background: "var(--mk-accent)", color: "var(--mk-on-accent)" };
  const stop = preview ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  return (
    <section id="contact" className={`${skin.section} px-5 py-16 @3xl:px-10 @3xl:py-24`}>
      <div className={`mx-auto flex max-w-5xl flex-col items-center gap-8 p-8 text-center @3xl:flex-row @3xl:p-12 @3xl:text-left ${skin.card}`}>
        {a.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.headshotUrl} alt={a.name} className={`h-36 w-36 shrink-0 object-cover ${style === "luxury" ? "" : "rounded-full"} ring-4 ring-white/60`} />
        ) : null}
        <div className="min-w-0 flex-1">
          <Label skin={skin} accent>
            Presented by
          </Label>
          <p className="mt-2 text-3xl @3xl:text-4xl" style={{ fontFamily: skin.font.head, fontWeight: skin.headWeight }}>
            {a.name}
          </p>
          {a.title || a.brokerage ? <p className={`mt-1 ${skin.muted}`}>{[a.title, a.brokerage].filter(Boolean).join(" · ")}</p> : null}
          {a.license ? <p className={`mt-1 text-xs ${skin.muted}`}>License {a.license}</p> : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3 @3xl:justify-start">
            {a.phone ? (
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} onClick={stop} className={`inline-flex items-center gap-2 ${btn}`} style={solid}>
                <Phone className="h-4 w-4" /> {a.phone}
              </a>
            ) : null}
            {a.email ? (
              <a href={`mailto:${a.email}`} onClick={stop} className={`inline-flex items-center gap-2 ${btn} ${style === "luxury" ? "" : "ring-1 ring-current/20"}`}>
                <Mail className="h-4 w-4" /> Email
              </a>
            ) : null}
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" onClick={stop} className={`inline-flex items-center gap-2 ${btn} ${style === "luxury" ? "" : "ring-1 ring-current/20"}`}>
                <Globe className="h-4 w-4" /> Website
              </a>
            ) : null}
          </div>
        </div>
        {a.brokerageLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.brokerageLogoUrl} alt={a.brokerage || "Brokerage"} className="max-h-16 max-w-[180px] object-contain [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.25))_drop-shadow(0_3px_8px_rgba(0,0,0,0.12))]" />
        ) : null}
      </div>
    </section>
  );
}

function Lightbox({ images, index, onClose, onMove }: { images: ViewImage[]; index: number; onClose: () => void; onMove: (d: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onMove]);
  const img = images[index];
  if (!img) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => onMove(-1)} className="absolute left-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6" aria-label="Previous photo">
        <ChevronLeft className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt} className="max-h-[88vh] max-w-[92vw] object-contain" />
      <button type="button" onClick={() => onMove(1)} className="absolute right-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6" aria-label="Next photo">
        <ChevronRight className="h-6 w-6" />
      </button>
      <p className="absolute bottom-4 text-sm text-white/70">
        {index + 1} / {images.length}
      </p>
    </div>
  );
}

export function ListingWebsite({ view, preview, previewRibbon }: ListingWebsiteProps) {
  const style = view.template;
  const skin = SKINS[style];
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + view.gallery.length) % view.gallery.length)), [view.gallery.length]);

  const vars = {
    "--mk-primary": view.branding.primary,
    "--mk-accent": view.branding.accent,
    "--mk-on-primary": view.branding.onPrimary,
    "--mk-on-accent": view.branding.onAccent,
    fontFamily: skin.font.body,
  } as CSSProperties;

  const render = (key: WebsiteSectionKey): ReactNode => {
    switch (key) {
      case "facts":
        return <Facts view={view} skin={skin} style={style} />;
      case "description":
        return <Description view={view} skin={skin} />;
      case "highlights":
        return <Highlights view={view} skin={skin} style={style} />;
      case "gallery":
        return <Gallery view={view} skin={skin} style={style} onOpen={(i) => (preview ? undefined : setOpen(i))} />;
      case "video":
        return <Videos view={view} skin={skin} />;
      case "floorplans":
        return <FloorPlans view={view} skin={skin} />;
      case "tour":
        return <Tours view={view} skin={skin} />;
      case "openhouse":
        return <OpenHouse view={view} skin={skin} style={style} />;
      case "agent":
        return <Agent view={view} skin={skin} style={style} preview={preview} />;
    }
  };

  const contactHref = view.showAgent ? "#contact" : undefined;
  return (
    <div className={`@container relative min-h-full ${skin.root}`} style={vars}>
      {previewRibbon ? (
        <div className="sticky top-0 z-30 bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950">{previewRibbon}</div>
      ) : null}
      <header
        className={`${style === "luxury" ? "absolute inset-x-0 top-0 z-20 text-white" : style === "coastal" ? "relative z-20" : "absolute inset-x-0 top-0 z-20 text-white"} ${previewRibbon ? "top-8" : ""}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 @3xl:px-10 @3xl:py-6">
          <div className="flex min-w-0 items-center gap-3">
            {view.branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.branding.logoUrl}
                alt=""
                className="h-10 max-w-[180px] object-contain [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.35))_drop-shadow(0_3px_6px_rgba(0,0,0,0.22))] @3xl:h-12 @3xl:max-w-[220px]"
              />
            ) : (
              <span className="truncate text-sm font-semibold uppercase tracking-[0.2em]" style={{ fontFamily: skin.font.body }}>
                {view.agent.brokerage || view.businessName}
              </span>
            )}
          </div>
          {contactHref ? (
            <a
              href={preview ? undefined : contactHref}
              className={
                style === "luxury"
                  ? "whitespace-nowrap border border-white/60 px-4 py-2 text-[11px] uppercase tracking-[0.3em] hover:bg-white hover:text-black"
                  : "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
              }
              style={style === "luxury" ? undefined : { background: "var(--mk-accent)", color: "var(--mk-on-accent)" }}
            >
              Contact agent
            </a>
          ) : null}
        </div>
      </header>
      <Hero view={view} skin={skin} style={style} />
      {view.sections.filter((s) => s.visible).map((s) => (
        <div key={s.key}>{render(s.key)}</div>
      ))}
      <footer className={`border-t ${skin.rule} px-5 py-10 text-center text-xs ${skin.muted}`}>
        <p>
          {view.property.address}
          {view.property.locality ? `, ${view.property.locality}` : ""}
        </p>
        {view.photographerCredit && view.businessName ? <p className="mt-2">Photography by {view.businessName}</p> : null}
        <p className="mt-2 opacity-70">Information deemed reliable but not guaranteed.</p>
        {view.poweredBy ? <PoweredByShootPortal className="mt-5 opacity-80" /> : null}
      </footer>
      {open != null && !preview ? <Lightbox images={view.gallery} index={open} onClose={() => setOpen(null)} onMove={move} /> : null}
    </div>
  );
}

/** @font-face for the template fonts — the same files the server uses for exports. */
export function MarketingFontFaces() {
  const faces: [string, number, string][] = [
    ["Inter", 400, "Inter-400"],
    ["Inter", 600, "Inter-600"],
    ["Inter", 700, "Inter-700"],
    ["Cormorant", 500, "Cormorant-500"],
    ["Cormorant", 600, "Cormorant-600"],
    ["DM Serif", 400, "DMSerif-400"],
    ["Nunito Sans", 400, "NunitoSans-400"],
    ["Nunito Sans", 700, "NunitoSans-700"],
  ];
  const css = faces
    .map(([family, weight, file]) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/marketing-fonts/${file}.ttf) format('truetype');}`)
    .join("");
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
