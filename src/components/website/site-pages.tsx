"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Globe, Mail, MapPin, Phone, X } from "lucide-react";
import type { SiteImage, SitePortfolioProject, SiteView } from "@/lib/website/view";
import { cn } from "@/lib/utils";
import { DisplayHeading, SITE_THEMES, SiteImg, SiteLink, SocialIcon, useSiteNav, type SiteTheme } from "@/components/website/site-ui";
import { SiteShell } from "@/components/website/site-shell";
import { BookingCta, ServicesBlock, WorkCard } from "@/components/website/site-home";

type Device = "desktop" | "mobile";

function PageIntro({ theme, eyebrow, title, intro, center }: { theme: SiteTheme; eyebrow: string; title: string; intro?: string; center?: boolean }) {
  const lux = theme.id === "luxury";
  return (
    <div className={cn(theme.container, lux ? "pt-24 pb-16 @3xl:pt-32" : "pt-16 pb-12 @3xl:pt-24 @3xl:pb-16", (center || lux) && "flex flex-col items-center text-center")}>
      <p className={cn(theme.eyebrow, lux ? "text-[var(--site-accent)]" : theme.id === "modern" ? "text-[var(--site-accent)]" : theme.muted, "site-rise")}>{eyebrow}</p>
      <DisplayHeading as="h1" theme={theme} className={cn("site-rise-2 mt-5 leading-[1.04]", lux ? "text-[3rem] @3xl:text-[4.75rem]" : theme.id === "modern" ? "text-[2.75rem] @3xl:text-[4.25rem]" : "text-[2.4rem] @3xl:text-[3.5rem]")}>
        {title}
      </DisplayHeading>
      {intro ? <p className={cn("site-rise-3 mt-6 max-w-2xl text-[17px] leading-relaxed", theme.muted)}>{intro}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio gallery
// ---------------------------------------------------------------------------

export function SitePortfolio({ view, preview = false, device = "desktop" }: { view: SiteView; preview?: boolean; device?: Device }) {
  const theme = SITE_THEMES[view.template];
  const categories = useMemo(() => Array.from(new Set(view.portfolio.map((p) => p.category).filter(Boolean))), [view.portfolio]);
  const [filter, setFilter] = useState<string | null>(null);
  const items = filter ? view.portfolio.filter((p) => p.category === filter) : view.portfolio;

  return (
    <SiteShell view={view} page="portfolio" preview={preview} device={device}>
      <PageIntro
        theme={theme}
        eyebrow="Portfolio"
        title={theme.id === "luxury" ? "The work" : theme.id === "minimal" ? "Work" : "Our portfolio"}
        intro={view.portfolio.length ? `A selection of recent projects by ${view.business.name}.` : undefined}
      />
      {view.portfolio.length === 0 ? (
        <div className={cn(theme.container, "pb-28 text-center")}>
          <p className={cn("mx-auto max-w-md text-[17px] leading-relaxed", theme.muted)}>New work is on the way. In the meantime, we’d love to hear about your project.</p>
          <div className="mt-8 flex justify-center">
            <SiteLink href={view.links.request} className={theme.btnPrimary}>
              {view.cta.label}
            </SiteLink>
          </div>
        </div>
      ) : (
        <div className={cn(theme.container, "pb-24 @3xl:pb-32")}>
          {categories.length > 1 ? (
            <div className={cn("mb-12 flex flex-wrap gap-2", theme.id === "luxury" && "justify-center gap-6")}>
              {[null, ...categories].map((c) => {
                const on = filter === c;
                return (
                  <button
                    key={c ?? "all"}
                    type="button"
                    onClick={() => setFilter(c)}
                    className={cn(
                      "transition",
                      theme.id === "modern" && cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-[#0B0D12] bg-[#0B0D12] text-white" : "border-[#E7E8EC] hover:border-[#0B0D12]/40"),
                      theme.id === "luxury" && cn(theme.eyebrow, "border-b pb-1", on ? "border-[var(--site-accent)] text-[var(--site-accent)]" : "border-transparent text-white/50 hover:text-white"),
                      theme.id === "minimal" && cn("mr-4 text-sm", on ? "underline underline-offset-[6px]" : theme.muted)
                    )}
                  >
                    {c ?? "All"}
                  </button>
                );
              })}
            </div>
          ) : null}
          {theme.id === "luxury" ? (
            <div className="grid gap-x-10 gap-y-16 @3xl:grid-cols-2 @6xl:grid-cols-3">
              {items.map((p, i) => (
                <div key={p.slug} className={cn(i % 3 === 1 && "@6xl:mt-20")}>
                  <WorkCard project={p} theme={theme} variant={i % 2 === 0 ? "tall" : "standard"} />
                </div>
              ))}
            </div>
          ) : (
            <div className={cn("grid @3xl:grid-cols-2", theme.id === "modern" ? "gap-5 @6xl:grid-cols-3" : "gap-x-8 gap-y-14 @6xl:grid-cols-3")}>
              {items.map((p) => (
                <WorkCard key={p.slug} project={p} theme={theme} />
              ))}
            </div>
          )}
        </div>
      )}
      <BookingCta view={view} theme={theme} />
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Project showcase
// ---------------------------------------------------------------------------

function Lightbox({ images, index, onClose, onMove }: { images: SiteImage[]; index: number; onClose: () => void; onMove: (d: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onMove]);
  const img = images[index];
  if (!img) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(-1);
          }}
          className="absolute left-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt} className="max-h-[88vh] max-w-[92vw] object-contain" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
          className="absolute right-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}
      <p className="absolute bottom-4 text-sm text-white/70">
        {index + 1} / {images.length}
      </p>
    </div>
  );
}

/** Photo layout: a calm rhythm of full-width and paired images (no cropping surprises). */
function Gallery({ photos, theme, onOpen }: { photos: SiteImage[]; theme: SiteTheme; onOpen: (i: number) => void }) {
  const rows: { items: { img: SiteImage; i: number }[] }[] = [];
  let i = 0;
  while (i < photos.length) {
    const full = rows.length % 3 === 0;
    if (full || i === photos.length - 1) {
      rows.push({ items: [{ img: photos[i]!, i }] });
      i += 1;
    } else {
      rows.push({ items: [{ img: photos[i]!, i }, { img: photos[i + 1]!, i: i + 1 }] });
      i += 2;
    }
  }
  const gap = theme.id === "modern" ? "gap-4 @3xl:gap-5" : theme.id === "luxury" ? "gap-6 @3xl:gap-10" : "gap-6 @3xl:gap-8";
  return (
    <div className={cn("flex flex-col", gap)}>
      {rows.map((row, r) => (
        <div key={r} className={cn("grid", gap, row.items.length === 2 && "@3xl:grid-cols-2")}>
          {row.items.map(({ img, i: idx }) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onOpen(idx)}
              className={cn("site-reveal group relative block w-full overflow-hidden", theme.imgRadius, theme.dark ? "bg-[#171513]" : "bg-[#F2F2F0]", row.items.length === 2 ? "aspect-[4/3]" : "aspect-[16/9]")}
              aria-label={`Open photo ${idx + 1}`}
            >
              <SiteImg src={row.items.length === 2 ? img.mediumUrl : img.url} alt={img.alt} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SiteProject({ view, project, preview = false, device = "desktop" }: { view: SiteView; project: SitePortfolioProject; preview?: boolean; device?: Device }) {
  const theme = SITE_THEMES[view.template];
  const nav = useSiteNav();
  const [open, setOpen] = useState<number | null>(null);
  // The cover is shown large at the top; the gallery below holds the rest. The lightbox pages
  // through every photo (cover included).
  const all = project.photos;
  const photos = all.length > 1 ? all.filter((p) => p.id !== project.cover?.id) : all;
  const openPhoto = (id: string) => {
    const i = all.findIndex((p) => p.id === id);
    if (i >= 0) setOpen(i);
  };
  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + all.length) % all.length)), [all.length]);
  const idx = view.portfolio.findIndex((p) => p.slug === project.slug);
  const next = view.portfolio.length > 1 ? view.portfolio[(idx + 1) % view.portfolio.length] : null;
  const lux = theme.id === "luxury";

  const meta = [
    project.photos.length ? `${project.photos.length} photo${project.photos.length === 1 ? "" : "s"}` : null,
    project.videos.length ? `${project.videos.length} film${project.videos.length === 1 ? "" : "s"}` : null,
    project.tours.length ? "Virtual tour" : null,
  ].filter(Boolean);

  return (
    <SiteShell view={view} page="project" overlayHeader={theme.id !== "minimal" && Boolean(project.cover)} preview={preview} device={device}>
      {project.cover && theme.id !== "minimal" ? (
        <section className="relative isolate flex min-h-[calc(var(--site-hero-h)*0.86)] items-end overflow-hidden bg-black text-white">
          <SiteImg src={project.cover.url} alt={project.cover.alt} eager className="site-hero-zoom absolute inset-0 h-full w-full object-cover" />
          <div className={cn("absolute inset-0", lux ? "bg-gradient-to-t from-black/85 via-black/25 to-black/40" : "bg-gradient-to-t from-black/75 via-black/10 to-black/20")} />
          <div className={cn(theme.container, "relative z-10 pb-14 pt-40", lux && "flex flex-col items-center text-center")}>
            {project.category ? <p className={cn(theme.eyebrow, "site-rise text-white/75")}>{project.category}</p> : null}
            <DisplayHeading as="h1" theme={theme} className={cn("site-rise-2 mt-4 max-w-4xl leading-[1.02]", lux ? "text-[3rem] font-normal @3xl:text-[5rem]" : "text-[2.75rem] @3xl:text-[4.5rem]")}>
              {project.title}
            </DisplayHeading>
          </div>
        </section>
      ) : (
        <div className={cn(theme.container, "pt-16 @3xl:pt-24")}>
          <SiteLink href="/portfolio" className={cn("inline-flex items-center gap-2 text-sm", theme.muted)}>
            <ArrowLeft className="h-4 w-4" /> All work
          </SiteLink>
          {project.category ? <p className={cn(theme.eyebrow, theme.muted, "mt-10")}>{project.category}</p> : null}
          <DisplayHeading as="h1" theme={theme} className="mt-4 max-w-4xl text-[2.4rem] leading-[1.06] @3xl:text-[3.6rem]">
            {project.title}
          </DisplayHeading>
          {project.cover ? (
            <button type="button" onClick={() => openPhoto(project.cover!.id)} className="mt-12 block aspect-[16/9] w-full overflow-hidden bg-[#F6F5F3]" aria-label="Open cover photo">
              <SiteImg src={project.cover.url} alt={project.cover.alt} eager className="h-full w-full object-cover" />
            </button>
          ) : null}
        </div>
      )}

      <div className={cn(theme.container, "py-14 @3xl:py-20")}>
        <div className={cn("mb-14 grid gap-8 border-b pb-10 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:items-end", theme.hairline)}>
          <div>
            {theme.id !== "minimal" ? (
              <SiteLink href="/portfolio" className={cn("inline-flex items-center gap-2 text-sm", theme.muted, "hover:opacity-80")}>
                <ArrowLeft className="h-4 w-4" /> Back to portfolio
              </SiteLink>
            ) : null}
            {project.description ? <p className={cn("mt-6 max-w-2xl whitespace-pre-line text-[17px] leading-relaxed", lux ? "text-[#EDE7DE]/85" : "text-current/85")}>{project.description}</p> : null}
          </div>
          {meta.length ? <p className={cn(theme.eyebrow, theme.muted)}>{meta.join("  ·  ")}</p> : null}
        </div>

        {photos.length ? <Gallery photos={photos} theme={theme} onOpen={(i) => openPhoto(photos[i]!.id)} /> : null}

        {project.videos.length ? (
          <section className="mt-20">
            <h2 className={cn(theme.eyebrow, theme.muted, "mb-6")}>Film</h2>
            <div className="grid gap-6">
              {project.videos.map((v) => (
                <div key={v.id} className={cn("site-reveal aspect-video overflow-hidden bg-black", theme.imgRadius)}>
                  {nav.preview ? (
                    <div className="relative h-full w-full">
                      {v.posterUrl ? <SiteImg src={v.posterUrl} alt={v.title} className="h-full w-full object-cover opacity-80" /> : null}
                      <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Video plays on the live site</span>
                    </div>
                  ) : v.kind === "youtube" ? (
                    <iframe src={v.src} title={v.title} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" />
                  ) : (
                    <video src={v.src} poster={v.posterUrl ?? undefined} controls playsInline preload="none" className="h-full w-full object-contain" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {project.tours.length ? (
          <section className="mt-20">
            <h2 className={cn(theme.eyebrow, theme.muted, "mb-6")}>Virtual tour</h2>
            <div className="grid gap-6">
              {project.tours.map((t) => (
                <div key={t.id} className={cn("site-reveal aspect-video overflow-hidden bg-black", theme.imgRadius)}>
                  {nav.preview ? (
                    <span className="flex h-full w-full items-center justify-center text-sm text-white/70">360° tour loads on the live site</span>
                  ) : (
                    <iframe src={t.embedUrl} title={t.title} className="h-full w-full" allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" loading="lazy" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {next && next.slug !== project.slug ? (
          <div className={cn("mt-24 border-t pt-10", theme.hairline)}>
            <SiteLink href={`/portfolio/${next.slug}`} className="group flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className={cn(theme.eyebrow, theme.muted)}>Next project</p>
                <p className={cn("mt-3 truncate text-[1.75rem] leading-tight transition group-hover:text-[var(--site-accent)] @3xl:text-[2.5rem]", theme.display)} style={{ fontFamily: theme.displayFont }}>
                  {next.title}
                </p>
              </div>
              <ArrowRight className="h-7 w-7 shrink-0 transition group-hover:translate-x-1" />
            </SiteLink>
          </div>
        ) : null}
      </div>

      <BookingCta view={view} theme={theme} />
      {open != null && !nav.preview ? <Lightbox images={all} index={open} onClose={() => setOpen(null)} onMove={move} /> : null}
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export function SiteServices({ view, preview = false, device = "desktop" }: { view: SiteView; preview?: boolean; device?: Device }) {
  const theme = SITE_THEMES[view.template];
  return (
    <SiteShell view={view} page="services" preview={preview} device={device}>
      <PageIntro theme={theme} eyebrow="Services" title={theme.id === "luxury" ? "What we offer" : "Services"} intro={`Everything ${view.business.name} can create for you. Not sure what you need? Tell us about the project and we’ll recommend the right fit.`} />
      <div className={cn(theme.container, "pb-24")}>
        {view.allServices.length ? (
          <ServicesBlock view={view} theme={theme} services={view.allServices} full />
        ) : (
          <p className={cn("text-center text-[17px]", theme.muted)}>Get in touch and we’ll put together the right package for your project.</p>
        )}
      </div>
      <BookingCta view={view} theme={theme} />
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Contact (+ embedded project request form)
// ---------------------------------------------------------------------------

export function SiteContact({
  view,
  form,
  preview = false,
  device = "desktop",
}: {
  view: SiteView;
  /** The existing ShootPortal request form (same fields, validation and workflow as /request). */
  form: ReactNode;
  preview?: boolean;
  device?: Device;
}) {
  const theme = SITE_THEMES[view.template];
  const b = view.business;
  const rows = [
    b.email ? { icon: Mail, label: "Email", value: b.email, href: `mailto:${b.email}` } : null,
    b.phone ? { icon: Phone, label: "Phone", value: b.phone, href: b.phoneHref } : null,
    b.websiteUrl ? { icon: Globe, label: "Website", value: b.websiteLabel || b.websiteUrl, href: b.websiteUrl } : null,
    b.addressLines.length ? { icon: MapPin, label: "Studio", value: b.addressLines.join(", "), href: "" } : null,
  ].filter((x): x is { icon: typeof Mail; label: string; value: string; href: string } => Boolean(x));

  const formSurface =
    theme.id === "modern"
      ? "rounded-3xl border border-[#E7E8EC] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,13,18,0.3)] @3xl:p-10"
      : theme.id === "luxury"
        ? "border border-white/10 bg-[#141210] p-6 @3xl:p-10"
        : "border-t border-[#EBEBEB] pt-8";

  return (
    <SiteShell view={view} page="contact" preview={preview} device={device}>
      <PageIntro theme={theme} eyebrow="Contact" title={theme.id === "luxury" ? "Let’s begin" : "Let’s talk"} intro={view.contactIntro} />
      <div className={cn(theme.container, "grid gap-14 pb-24 @4xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] @4xl:gap-20 @3xl:pb-32")}>
        <aside className="space-y-10">
          {rows.length ? (
            <ul className="space-y-7">
              {rows.map((r) => (
                <li key={r.label} className="flex gap-4">
                  <span className={cn("mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center", theme.id === "modern" ? "rounded-full bg-[#F5F6F8] text-[var(--site-accent)]" : theme.id === "luxury" ? "border border-white/15 text-[var(--site-accent)]" : "text-[#171717]")}>
                    <r.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className={cn(theme.eyebrow, theme.muted)}>{r.label}</p>
                    {r.href ? (
                      <SiteLink href={r.href} newTab={r.label === "Website"} className="mt-1.5 block break-words text-[17px] transition hover:text-[var(--site-accent)]">
                        {r.value}
                      </SiteLink>
                    ) : (
                      <p className="mt-1.5 text-[17px]">{r.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {b.social.length ? (
            <div>
              <p className={cn(theme.eyebrow, theme.muted)}>Follow</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {b.social.map((s) => (
                  <SiteLink
                    key={s.key}
                    href={s.url}
                  newTab
                    ariaLabel={s.label}
                    className={cn("inline-flex h-11 w-11 items-center justify-center transition", theme.id === "luxury" ? "border border-white/15 hover:border-[var(--site-accent)]" : "rounded-full border border-current/15 hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]")}
                  >
                    <SocialIcon k={s.key} className="h-[18px] w-[18px]" />
                  </SiteLink>
                ))}
              </div>
            </div>
          ) : null}
          {view.links.showClientLogin ? (
            <p className={cn("text-sm", theme.muted)}>
              Already a client?{" "}
              <SiteLink href={view.links.clientLogin} className="underline underline-offset-4 hover:text-[var(--site-accent)]">
                Sign in to your portal
              </SiteLink>
            </p>
          ) : null}
        </aside>
        <div className={formSurface}>
          <DisplayHeading as="h2" theme={theme} className={cn("mb-2", theme.id === "luxury" ? "text-[2.2rem]" : "text-[1.6rem]")}>
            {view.cta.heading}
          </DisplayHeading>
          <p className={cn("mb-8 text-[15px]", theme.muted)}>{view.cta.text}</p>
          {form}
        </div>
      </div>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// /request inside the website (when the Business Website is live)
// ---------------------------------------------------------------------------

export function SiteRequest({ view, form }: { view: SiteView; form: ReactNode }) {
  const theme = SITE_THEMES[view.template];
  const surface =
    theme.id === "modern"
      ? "rounded-3xl border border-[#E7E8EC] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,13,18,0.3)] @3xl:p-10"
      : theme.id === "luxury"
        ? "border border-white/10 bg-[#141210] p-6 @3xl:p-10"
        : "border-t border-[#EBEBEB] pt-8";
  return (
    <SiteShell view={view} page="request">
      <PageIntro theme={theme} eyebrow={view.cta.label} title={view.cta.heading} intro={view.cta.text} center />
      <div className={cn(theme.container, "pb-24 @3xl:pb-32")}>
        <div className={cn("mx-auto max-w-2xl", surface)}>{form}</div>
      </div>
    </SiteShell>
  );
}
