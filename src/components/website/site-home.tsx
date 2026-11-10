"use client";

import { useRef } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { SitePortfolioProject, SiteService, SiteTestimonial, SiteView } from "@/lib/website/view";
import { cn } from "@/lib/utils";
import { DisplayHeading, SITE_THEMES, SiteImg, SiteLink, initials, useSiteNav, type SiteTheme } from "@/components/website/site-ui";
import { SiteShell } from "@/components/website/site-shell";

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroBackdrop({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  const { preview } = useSiteNav();
  const m = view.hero.media;
  if (m.kind === "image") {
    return <SiteImg src={m.url} alt={m.alt} eager className="site-hero-zoom absolute inset-0 h-full w-full object-cover" />;
  }
  if (m.kind === "file-video") {
    if (preview) {
      return (
        <>
          {m.posterUrl ? <SiteImg src={m.posterUrl} alt="" eager className="absolute inset-0 h-full w-full object-cover" /> : null}
          <span className="absolute right-6 bottom-6 z-20 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white">
            <Play className="h-3 w-3 fill-current" /> Background video
          </span>
        </>
      );
    }
    return (
      <video
        src={m.src}
        poster={m.posterUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }
  if (m.kind === "video") {
    if (preview) {
      return (
        <>
          <SiteImg src={m.posterUrl} alt="" eager className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute right-6 bottom-6 z-20 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white">
            <Play className="h-3 w-3 fill-current" /> Background video
          </span>
        </>
      );
    }
    const src = `https://www.youtube-nocookie.com/embed/${m.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${m.youtubeId}&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3`;
    return (
      <div className="absolute inset-0 overflow-hidden [container-type:size]" aria-hidden>
        <SiteImg src={m.posterUrl} alt="" eager className="absolute inset-0 h-full w-full object-cover" />
        <iframe
          src={src}
          title="Background video"
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 border-0"
        />
      </div>
    );
  }
  // Designed fallback — no stock photography (it would imply someone else's work is theirs).
  if (theme.id === "luxury") {
    return (
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 38%, color-mix(in srgb, var(--site-accent) 26%, transparent), transparent 72%), radial-gradient(120% 80% at 50% 120%, #1c1916, transparent 60%), #0E0D0C",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[28cqw] leading-none text-white/[0.035]"
          style={{ fontFamily: theme.displayFont }}
          aria-hidden
        >
          {initials(view.business.name)}
        </span>
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(70% 70% at 88% 8%, color-mix(in srgb, var(--site-accent) 70%, transparent), transparent 62%), radial-gradient(60% 70% at 6% 96%, color-mix(in srgb, var(--site-primary) 85%, transparent), transparent 64%), linear-gradient(160deg, #10131B, #07080B)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(70% 60% at 70% 30%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 70% 30%, black, transparent 75%)",
        }}
      />
    </div>
  );
}

function ModernHero({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  return (
    <section className="relative isolate flex min-h-[var(--site-hero-h)] items-end overflow-hidden bg-[#07080B] text-white">
      <HeroBackdrop view={view} theme={theme} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      <div className={cn(theme.container, "relative z-10 pb-16 pt-40 @3xl:pb-24")}>
        <p className={cn(theme.eyebrow, "site-rise text-white/75")}>{view.hero.eyebrow}</p>
        <DisplayHeading as="h1" theme={theme} className="site-rise-2 mt-5 max-w-[14ch] text-[2.75rem] leading-[1.02] @3xl:text-[4.5rem] @6xl:text-[5.5rem]">
          {view.hero.headline}
        </DisplayHeading>
        {view.hero.intro ? <p className="site-rise-3 mt-6 max-w-xl text-base leading-relaxed text-white/80 @3xl:text-lg">{view.hero.intro}</p> : null}
        <div className="site-rise-3 mt-9 flex flex-wrap gap-3">
          <SiteLink href={view.links.request} className={theme.btnPrimary}>
            {view.cta.label} <ArrowRight className="h-4 w-4" />
          </SiteLink>
          {view.portfolio.length ? (
            <SiteLink href="/portfolio" className={theme.btnOnImage}>
              View portfolio
            </SiteLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LuxuryHero({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  return (
    <section className="relative isolate flex min-h-[var(--site-hero-h)] items-center justify-center overflow-hidden bg-[#0E0D0C] text-white">
      <HeroBackdrop view={view} theme={theme} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15),rgba(0,0,0,0.7))]" />
      <div className={cn(theme.container, "relative z-10 flex flex-col items-center py-40 text-center")}>
        <p className={cn(theme.eyebrow, "site-rise text-white/70")}>{view.hero.eyebrow}</p>
        <span className="site-rise mt-6 h-px w-16 bg-[var(--site-accent)]" />
        <DisplayHeading as="h1" theme={theme} className="site-rise-2 mt-8 max-w-[18ch] text-[2.9rem] font-normal leading-[1.04] @3xl:text-[4.75rem] @6xl:text-[6rem]">
          {view.hero.headline}
        </DisplayHeading>
        {view.hero.intro ? <p className="site-rise-3 mt-7 max-w-xl text-[15px] leading-relaxed text-white/70">{view.hero.intro}</p> : null}
        <div className="site-rise-3 mt-11 flex flex-wrap justify-center gap-4">
          <SiteLink href={view.links.request} className={theme.btnPrimary}>
            {view.cta.label}
          </SiteLink>
          {view.portfolio.length ? (
            <SiteLink href="/portfolio" className={theme.btnOnImage}>
              The portfolio
            </SiteLink>
          ) : null}
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/50 @3xl:flex" aria-hidden>
        Scroll
        <span className="h-10 w-px bg-gradient-to-b from-white/60 to-transparent" />
      </div>
    </section>
  );
}

function MinimalHero({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  const m = view.hero.media;
  return (
    <section>
      <div className={cn(theme.container, "pt-16 pb-14 @3xl:pt-28 @3xl:pb-20")}>
        <p className={cn(theme.eyebrow, theme.muted, "site-rise")}>{view.hero.eyebrow}</p>
        <DisplayHeading as="h1" theme={theme} className="site-rise-2 mt-6 max-w-[20ch] text-[2.4rem] leading-[1.08] @3xl:text-[3.6rem] @6xl:text-[4.25rem]">
          {view.hero.headline}
        </DisplayHeading>
        <div className="site-rise-3 mt-8 grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_auto] @4xl:items-end">
          {view.hero.intro ? <p className={cn("max-w-xl text-[17px] leading-relaxed", theme.muted)}>{view.hero.intro}</p> : <span />}
          <div className="flex flex-wrap gap-8">
            <SiteLink href={view.links.request} className={theme.btnPrimary}>
              {view.cta.label} <ArrowRight className="h-4 w-4" />
            </SiteLink>
            {view.portfolio.length ? (
              <SiteLink href="/portfolio" className={theme.btnGhost}>
                Selected work
              </SiteLink>
            ) : null}
          </div>
        </div>
      </div>
      <div className={cn(theme.container, "pb-6")}>
        <div className="relative aspect-[16/9] overflow-hidden @4xl:aspect-[21/9]">
          {m.kind === "design" ? (
            <div className={cn("absolute inset-0 flex items-end justify-between p-8 @3xl:p-12", theme.surface)}>
              <span className="select-none text-[18cqw] leading-[0.8] tracking-[-0.06em] text-[#171717]/[0.06] @4xl:text-[14cqw]" aria-hidden>
                {initials(view.business.name)}
              </span>
              <span className="mb-3 h-px w-24 bg-[var(--site-accent)]" aria-hidden />
            </div>
          ) : (
            <HeroBackdrop view={view} theme={theme} />
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export function ServicesBlock({ view, theme, services, full = false }: { view: SiteView; theme: SiteTheme; services: SiteService[]; full?: boolean }) {
  if (!services.length) return null;
  if (theme.id === "minimal") {
    return (
      <ul className={cn("border-t", theme.hairline)}>
        {services.map((s) => (
          <li key={s.id} className={cn("site-reveal grid gap-3 border-b py-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] @3xl:gap-10", theme.hairline)}>
            <h3 className="text-xl tracking-[-0.02em]" style={{ fontFamily: theme.displayFont }}>
              {s.name}
            </h3>
            <div className="space-y-3">
              {s.description ? <p className={cn("text-[15px] leading-relaxed", theme.muted)}>{s.description}</p> : null}
              {full && s.includes.length ? (
                <ul className={cn("flex flex-wrap gap-x-5 gap-y-1 text-sm", theme.muted)}>
                  {s.includes.map((i) => (
                    <li key={i}>— {i}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex items-start gap-6 @3xl:flex-col @3xl:items-end">
              {s.priceLabel ? <p className="text-sm">{s.priceLabel}</p> : null}
              <SiteLink href={view.links.request} className={theme.btnGhost}>
                Book
              </SiteLink>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (theme.id === "luxury") {
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return (
      <div className="grid gap-x-16 @3xl:grid-cols-2">
        {services.map((s, i) => (
          <div key={s.id} className="site-reveal border-t border-white/10 py-10">
            <div className="flex items-baseline gap-6">
              <span className="w-8 shrink-0 text-sm text-[var(--site-accent)]" style={{ fontFamily: theme.displayFont }}>
                {roman[i] ?? i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.9rem] leading-tight" style={{ fontFamily: theme.displayFont }}>
                  {s.name}
                </h3>
                {s.description ? <p className={cn("mt-3 text-[15px] leading-relaxed", theme.muted)}>{s.description}</p> : null}
                {full && s.includes.length ? (
                  <ul className={cn("mt-4 space-y-1.5 text-sm", theme.muted)}>
                    {s.includes.map((inc) => (
                      <li key={inc} className="flex gap-2">
                        <span className="text-[var(--site-accent)]">·</span> {inc}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.priceLabel ? <p className={cn(theme.eyebrow, "mt-5 text-[#EDE7DE]/80")}>{s.priceLabel}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5 @3xl:grid-cols-2 @6xl:grid-cols-3">
      {services.map((s, i) => (
        <div key={s.id} className="site-reveal group flex flex-col rounded-2xl border border-[#E7E8EC] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_60px_-28px_rgba(11,13,18,0.35)]">
          <span className="text-sm font-semibold text-[var(--site-accent)]">{String(i + 1).padStart(2, "0")}</span>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em]">{s.name}</h3>
          {s.description ? <p className={cn("mt-3 text-[15px] leading-relaxed", theme.muted)}>{s.description}</p> : null}
          {s.includes.length ? (
            <ul className="mt-5 space-y-2 text-sm text-[#2B2F3A]">
              {s.includes.map((inc) => (
                <li key={inc} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" /> {inc}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-auto flex items-center justify-between pt-8">
            <span className="text-sm font-semibold">{s.priceLabel ?? ""}</span>
            <SiteLink href={view.links.request} className="inline-flex items-center gap-1.5 text-sm font-semibold opacity-80 transition group-hover:opacity-100">
              Book <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </SiteLink>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkCard({ project, theme, variant = "standard" }: { project: SitePortfolioProject; theme: SiteTheme; variant?: "standard" | "large" | "tall" }) {
  const aspect = variant === "large" ? "aspect-[16/10]" : variant === "tall" ? "aspect-[4/5]" : theme.id === "minimal" ? "aspect-[4/3]" : "aspect-[3/2]";
  const img = project.cover;
  if (theme.id === "modern") {
    return (
      <SiteLink href={`/portfolio/${project.slug}`} className="site-reveal group relative block overflow-hidden rounded-2xl bg-[#0B0D12]">
        <div className={cn("relative", aspect)}>
          {img ? <SiteImg src={variant === "large" ? img.url : img.mediumUrl} alt={img.alt} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white">
            <div className="min-w-0">
              {project.category ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{project.category}</p> : null}
              <h3 className="mt-1.5 truncate text-xl font-semibold tracking-[-0.02em]">{project.title}</h3>
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-[var(--site-accent)] group-hover:text-[var(--site-on-accent)]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </SiteLink>
    );
  }
  if (theme.id === "luxury") {
    return (
      <SiteLink href={`/portfolio/${project.slug}`} className="site-reveal group block">
        <div className={cn("relative overflow-hidden bg-[#171513]", aspect)}>
          {img ? <SiteImg src={img.mediumUrl} alt={img.alt} className="absolute inset-0 h-full w-full object-cover transition duration-[1400ms] ease-out group-hover:scale-[1.05]" /> : null}
          <div className="absolute inset-0 bg-black/10 transition duration-700 group-hover:bg-black/0" />
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-4">
          <h3 className="text-2xl leading-tight transition group-hover:text-[var(--site-accent)]" style={{ fontFamily: theme.displayFont }}>
            {project.title}
          </h3>
          {project.category ? <span className={cn(theme.eyebrow, theme.muted, "shrink-0")}>{project.category}</span> : null}
        </div>
      </SiteLink>
    );
  }
  return (
    <SiteLink href={`/portfolio/${project.slug}`} className="site-reveal group block">
      <div className={cn("relative overflow-hidden bg-[#F6F5F3]", aspect)}>
        {img ? <SiteImg src={img.mediumUrl} alt={img.alt} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:opacity-90" /> : null}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
        <h3 className="font-semibold">{project.title}</h3>
        {project.category ? <span className={theme.muted}>{project.category}</span> : null}
      </div>
    </SiteLink>
  );
}

function FeaturedWork({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  const items = view.featured;
  if (!items.length) return null;
  if (theme.id === "modern") {
    const [first, ...rest] = items;
    return (
      <div className="grid gap-5 @3xl:grid-cols-2">
        <div className="@3xl:col-span-2">
          <WorkCard project={first!} theme={theme} variant={rest.length ? "large" : "large"} />
        </div>
        {rest.slice(0, 4).map((p) => (
          <WorkCard key={p.slug} project={p} theme={theme} />
        ))}
      </div>
    );
  }
  if (theme.id === "luxury") {
    return (
      <div className="grid gap-x-10 gap-y-16 @3xl:grid-cols-2">
        {items.slice(0, 4).map((p, i) => (
          <div key={p.slug} className={cn(i % 2 === 1 && "@3xl:mt-24")}>
            <WorkCard project={p} theme={theme} variant={i % 2 === 0 ? "tall" : "standard"} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-x-8 gap-y-14 @3xl:grid-cols-2 @6xl:grid-cols-3">
      {items.slice(0, 6).map((p) => (
        <WorkCard key={p.slug} project={p} theme={theme} />
      ))}
    </div>
  );
}

function SectionHeader({ theme, eyebrow, title, action }: { theme: SiteTheme; eyebrow: string; title: string; action?: React.ReactNode }) {
  if (theme.id === "luxury") {
    return (
      <div className="mb-16 flex flex-col items-center text-center">
        <p className={cn(theme.eyebrow, "text-[var(--site-accent)]")}>{eyebrow}</p>
        <DisplayHeading theme={theme} className="mt-5 text-[2.6rem] leading-tight @3xl:text-[3.5rem]">
          {title}
        </DisplayHeading>
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    );
  }
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className={cn(theme.eyebrow, theme.id === "modern" ? "text-[var(--site-accent)]" : theme.muted)}>{eyebrow}</p>
        <DisplayHeading theme={theme} className={cn("mt-4 max-w-2xl leading-[1.08]", theme.id === "modern" ? "text-[2.25rem] @3xl:text-[3rem]" : "text-[1.9rem] @3xl:text-[2.4rem]")}>
          {title}
        </DisplayHeading>
      </div>
      {action}
    </div>
  );
}

export function BookingCta({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  if (theme.id === "luxury") {
    return (
      <section className="border-t border-white/10">
        <div className={cn(theme.container, "flex flex-col items-center py-28 text-center @3xl:py-36")}>
          <span className="h-px w-16 bg-[var(--site-accent)]" />
          <DisplayHeading theme={theme} className="site-reveal mt-10 max-w-3xl text-[2.6rem] leading-[1.08] @3xl:text-[4rem]">
            {view.cta.heading}
          </DisplayHeading>
          <p className={cn("mt-6 max-w-lg text-[15px] leading-relaxed", theme.muted)}>{view.cta.text}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <SiteLink href={view.links.request} className={theme.btnPrimary}>
              {view.cta.label}
            </SiteLink>
            <SiteLink href="/contact" className={theme.btnGhost}>
              Contact
            </SiteLink>
          </div>
        </div>
      </section>
    );
  }
  if (theme.id === "minimal") {
    return (
      <section className={cn("border-t", theme.hairline)}>
        <div className={cn(theme.container, "py-28 @3xl:py-36")}>
          <DisplayHeading theme={theme} className="site-reveal max-w-3xl text-[2.2rem] leading-[1.1] @3xl:text-[3.2rem]">
            {view.cta.heading}
          </DisplayHeading>
          <p className={cn("mt-6 max-w-lg text-[17px] leading-relaxed", theme.muted)}>{view.cta.text}</p>
          <div className="mt-10 flex flex-wrap gap-8">
            <SiteLink href={view.links.request} className={theme.btnPrimary}>
              {view.cta.label} <ArrowRight className="h-4 w-4" />
            </SiteLink>
            <SiteLink href="/contact" className={theme.btnGhost}>
              Contact
            </SiteLink>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={cn(theme.container, "py-16 @3xl:py-24")}>
      <div className="site-reveal relative overflow-hidden rounded-[28px] bg-[#0B0D12] px-8 py-16 text-white @3xl:px-16 @3xl:py-20">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "radial-gradient(60% 90% at 100% 0%, color-mix(in srgb, var(--site-accent) 55%, transparent), transparent 60%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-10 @4xl:flex-row @4xl:items-end @4xl:justify-between">
          <div className="max-w-2xl">
            <DisplayHeading theme={theme} className="text-[2.25rem] leading-[1.05] @3xl:text-[3.25rem]">
              {view.cta.heading}
            </DisplayHeading>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75">{view.cta.text}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SiteLink href={view.links.request} className={theme.btnPrimary}>
              {view.cta.label} <ArrowRight className="h-4 w-4" />
            </SiteLink>
            <SiteLink href="/contact" className={theme.btnOnImage}>
              Contact us
            </SiteLink>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

function Attribution({ t, theme }: { t: SiteTestimonial; theme: SiteTheme }) {
  if (!t.name && !t.title) return null;
  if (theme.id === "luxury") {
    return (
      <p className={cn(theme.eyebrow, "mt-6 text-[var(--site-accent)]")}>
        {t.name}
        {t.name && t.title ? <span className="text-white/40"> · </span> : null}
        {t.title ? <span className="text-white/55">{t.title}</span> : null}
      </p>
    );
  }
  return (
    <p className="mt-6 text-sm">
      {t.name ? <span className="font-semibold">{t.name}</span> : null}
      {t.name && t.title ? <span className={theme.muted}>, </span> : null}
      {t.title ? <span className={theme.muted}>{t.title}</span> : null}
    </p>
  );
}

function QuoteMark({ theme }: { theme: SiteTheme }) {
  if (theme.id === "minimal") return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-6 w-6 text-[var(--site-accent)]", theme.id === "luxury" && "opacity-80")} fill="currentColor">
      <path d="M9.5 6C6.5 7.3 4.5 10 4.5 13.6V18h5v-5H7.2c.2-2 1.4-3.6 3.3-4.6L9.5 6Zm9 0c-3 1.3-5 4-5 7.6V18h5v-5h-2.3c.2-2 1.4-3.6 3.3-4.6L18.5 6Z" />
    </svg>
  );
}

function TestimonialCard({ t, theme, featured = false }: { t: SiteTestimonial; theme: SiteTheme; featured?: boolean }) {
  const text = (
    <blockquote
      className={cn(
        "whitespace-pre-line",
        theme.id === "luxury" ? (featured ? "text-[1.9rem] leading-[1.35] @3xl:text-[2.4rem]" : "text-[1.35rem] leading-[1.45]") : "",
        theme.id === "modern" ? (featured ? "text-[1.35rem] font-medium leading-[1.5] tracking-[-0.01em] @3xl:text-[1.6rem]" : "text-[16px] leading-relaxed text-[#2B2F3A]") : "",
        theme.id === "minimal" ? (featured ? "text-[1.4rem] leading-[1.55] @3xl:text-[1.7rem]" : "text-[16px] leading-relaxed") : ""
      )}
      style={theme.id === "luxury" ? { fontFamily: theme.displayFont } : undefined}
    >
      {featured || theme.id === "minimal" ? `“${t.quote}”` : t.quote}
    </blockquote>
  );
  if (featured) {
    return (
      <figure className="site-reveal mx-auto flex max-w-3xl flex-col items-center text-center">
        <QuoteMark theme={theme} />
        <div className="mt-6">{text}</div>
        <figcaption>
          <Attribution t={t} theme={theme} />
        </figcaption>
      </figure>
    );
  }
  return (
    <figure
      className={cn(
        "site-reveal flex h-full flex-col",
        theme.id === "modern" && "rounded-2xl border border-[#E7E8EC] bg-white p-7",
        theme.id === "luxury" && "border-t border-white/12 pt-8",
        theme.id === "minimal" && "border-l border-[#E2E2E2] pl-6"
      )}
    >
      {theme.id !== "minimal" ? <QuoteMark theme={theme} /> : null}
      <div className={cn(theme.id !== "minimal" && "mt-5")}>{text}</div>
      <figcaption className="mt-auto">
        <Attribution t={t} theme={theme} />
      </figcaption>
    </figure>
  );
}

/** Up to three reviews sit in a grid; more become a swipeable row with arrow buttons. */
function TestimonialCarousel({ items, theme }: { items: SiteTestimonial[]; theme: SiteTheme }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.9, behavior: "smooth" });
  const btn = cn(
    "inline-flex h-11 w-11 items-center justify-center transition",
    theme.id === "modern" && "rounded-full border border-[#E7E8EC] bg-white hover:border-[#0B0D12]/30",
    theme.id === "luxury" && "border border-white/20 hover:border-[var(--site-accent)]",
    theme.id === "minimal" && "rounded-full border border-[#E2E2E2] hover:border-[#171717]"
  );
  return (
    <div>
      <div
        ref={row}
        className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label="Client testimonials"
      >
        {items.map((t) => (
          <div key={t.id} className="w-[85%] shrink-0 snap-start @3xl:w-[calc(50%-10px)] @5xl:w-[calc(33.333%-14px)]">
            <TestimonialCard t={t} theme={theme} />
          </div>
        ))}
      </div>
      <div className={cn("mt-8 flex gap-2", theme.id === "luxury" && "justify-center")}>
        <button type="button" className={btn} onClick={() => scroll(-1)} aria-label="Previous testimonials">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" className={btn} onClick={() => scroll(1)} aria-label="More testimonials">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function TestimonialsSection({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  const items = view.testimonials;
  if (!items.length) return null;
  const pad = theme.id === "luxury" ? "py-28 @3xl:py-32" : "py-20 @3xl:py-28";
  return (
    <section aria-labelledby="site-testimonials" className={cn(theme.id === "minimal" && "border-t border-[#EBEBEB]")}>
      <div className={cn(theme.container, pad)}>
        {items.length === 1 ? (
          <>
            <p id="site-testimonials" className={cn(theme.eyebrow, "mb-10 text-center", theme.id === "minimal" ? theme.muted : "text-[var(--site-accent)]")}>
              What our clients say
            </p>
            <TestimonialCard t={items[0]!} theme={theme} featured />
          </>
        ) : (
          <>
            <div className={cn("mb-12", theme.id === "luxury" && "text-center")}>
              <p className={cn(theme.eyebrow, theme.id === "minimal" ? theme.muted : "text-[var(--site-accent)]")}>Testimonials</p>
              <DisplayHeading theme={theme} className={cn("mt-4 leading-tight", theme.id === "luxury" ? "text-[2.6rem] @3xl:text-[3.25rem]" : theme.id === "modern" ? "text-[2.25rem] @3xl:text-[3rem]" : "text-[1.9rem] @3xl:text-[2.4rem]")}>
                <span id="site-testimonials">What our clients say</span>
              </DisplayHeading>
            </div>
            {items.length <= 3 ? (
              <div className={cn("grid gap-5", items.length === 2 ? "@3xl:grid-cols-2" : "@4xl:grid-cols-3", theme.id === "luxury" && "gap-x-12 gap-y-10")}>
                {items.map((t) => (
                  <TestimonialCard key={t.id} t={t} theme={theme} />
                ))}
              </div>
            ) : (
              <TestimonialCarousel items={items} theme={theme} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SiteHome({ view, preview = false, device = "desktop" }: { view: SiteView; preview?: boolean; device?: "desktop" | "mobile" }) {
  const theme = SITE_THEMES[view.template];
  const hasWork = view.featured.length > 0;
  const hasServices = view.services.length > 0;
  const sectionPad = theme.id === "luxury" ? "py-28 @3xl:py-36" : "py-20 @3xl:py-28";

  return (
    <SiteShell view={view} page="home" overlayHeader={theme.id !== "minimal"} preview={preview} device={device}>
      {theme.id === "modern" ? <ModernHero view={view} theme={theme} /> : theme.id === "luxury" ? <LuxuryHero view={view} theme={theme} /> : <MinimalHero view={view} theme={theme} />}

      {hasWork ? (
        <section className={cn(theme.container, sectionPad)}>
          <SectionHeader
            theme={theme}
            eyebrow={theme.id === "luxury" ? "Selected work" : "Featured work"}
            title={theme.id === "luxury" ? "Recent commissions" : theme.id === "minimal" ? "Selected projects" : "Work we’re proud of"}
            action={
              view.portfolio.length > 0 ? (
                <SiteLink href="/portfolio" className={theme.id === "modern" ? theme.btnGhost : theme.btnGhost}>
                  View full portfolio {theme.id !== "luxury" ? <ArrowRight className="h-4 w-4" /> : null}
                </SiteLink>
              ) : null
            }
          />
          <FeaturedWork view={view} theme={theme} />
        </section>
      ) : null}

      {hasServices ? (
        <section className={cn(theme.id === "modern" && "bg-[#F5F6F8]", theme.id === "luxury" && "bg-[#121110]")}>
          <div className={cn(theme.container, sectionPad)}>
            <SectionHeader
              theme={theme}
              eyebrow="Services"
              title={theme.id === "luxury" ? "What we offer" : theme.id === "minimal" ? "Services" : "What we do"}
              action={
                view.allServices.length > view.services.length ? (
                  <SiteLink href="/services" className={theme.btnGhost}>
                    All services
                  </SiteLink>
                ) : null
              }
            />
            <ServicesBlock view={view} theme={theme} services={view.services} />
          </div>
        </section>
      ) : null}

      {/* Client testimonials: directly below Services, only when the business added reviews. */}
      <TestimonialsSection view={view} theme={theme} />

      <BookingCta view={view} theme={theme} />
    </SiteShell>
  );
}
