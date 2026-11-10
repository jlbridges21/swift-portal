"use client";

/**
 * Business Website — shared primitives for the three templates.
 *
 * Layout uses CONTAINER queries (@container / @3xl: / @5xl:) instead of viewport breakpoints, so
 * the same markup responds correctly on the live site and inside the scaled desktop/mobile
 * preview in Settings → Business Website.
 */

import Link from "next/link";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { WebsiteTemplateId } from "@/lib/website/settings";
import type { SiteView } from "@/lib/website/view";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Navigation (live links vs. in-editor preview navigation)
// ---------------------------------------------------------------------------

type SiteNav = { preview: boolean; navigate?: (href: string) => void };
const SiteNavContext = createContext<SiteNav>({ preview: false });

export function SiteNavProvider({ preview, navigate, children }: SiteNav & { children: ReactNode }) {
  return <SiteNavContext.Provider value={{ preview, navigate }}>{children}</SiteNavContext.Provider>;
}

export function useSiteNav() {
  return useContext(SiteNavContext);
}

export function SiteLink({
  href,
  className,
  children,
  ariaLabel,
  onClick,
  newTab = false,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
  /** Social profiles and other sites open in a new tab; client login stays in this tab. */
  newTab?: boolean;
}) {
  const nav = useSiteNav();
  const external = /^https?:\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
  if (nav.preview) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
          if (!external) nav.navigate?.(href);
        }}
      >
        {children}
      </a>
    );
  }
  if (external) {
    return (
      <a href={href} aria-label={ariaLabel} className={className} onClick={onClick} {...(newTab && /^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={ariaLabel} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Fonts + motion (self-hosted files shared with the Marketing Kit)
// ---------------------------------------------------------------------------

export function WebsiteStyles() {
  const faces: [string, number, string][] = [
    ["SiteInter", 400, "Inter-400"],
    ["SiteInter", 600, "Inter-600"],
    ["SiteInter", 700, "Inter-700"],
    ["SiteCormorant", 500, "Cormorant-500"],
    ["SiteCormorant", 600, "Cormorant-600"],
    ["SiteNunito", 400, "NunitoSans-400"],
    ["SiteNunito", 700, "NunitoSans-700"],
  ];
  const css =
    faces
      .map(
        ([family, weight, file]) =>
          `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/marketing-fonts/${file}.ttf) format('truetype');}`
      )
      .join("") +
    `@keyframes site-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
     @keyframes site-fade{from{opacity:0}to{opacity:1}}
     @keyframes site-zoom{from{transform:scale(1.08)}to{transform:scale(1)}}
     .site-rise{animation:site-rise .9s cubic-bezier(.2,.7,.2,1) both}
     .site-rise-2{animation:site-rise .9s .12s cubic-bezier(.2,.7,.2,1) both}
     .site-rise-3{animation:site-rise .9s .24s cubic-bezier(.2,.7,.2,1) both}
     .site-hero-zoom{animation:site-zoom 2.4s cubic-bezier(.2,.7,.2,1) both}
     @supports (animation-timeline: view()){.site-reveal{animation:site-rise linear both;animation-timeline:view();animation-range:entry 0% cover 22%}}
     [data-site-preview] .site-reveal{animation:none!important;opacity:1;transform:none}
     @media (prefers-reduced-motion: reduce){.site-rise,.site-rise-2,.site-rise-3,.site-hero-zoom,.site-reveal{animation:none!important}}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// ---------------------------------------------------------------------------
// Template tokens
// ---------------------------------------------------------------------------

export type SiteTheme = {
  id: WebsiteTemplateId;
  dark: boolean;
  root: string;
  bodyFont: string;
  displayFont: string;
  display: string;
  eyebrow: string;
  muted: string;
  hairline: string;
  surface: string;
  container: string;
  btnPrimary: string;
  btnGhost: string;
  btnOnImage: string;
  imgRadius: string;
  navLink: string;
};

const BASE_BTN =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const SITE_THEMES: Record<WebsiteTemplateId, SiteTheme> = {
  modern: {
    id: "modern",
    dark: false,
    root: "bg-white text-[#0B0D12]",
    bodyFont: "'SiteInter', ui-sans-serif, system-ui, sans-serif",
    displayFont: "'SiteInter', ui-sans-serif, system-ui, sans-serif",
    display: "font-bold tracking-[-0.035em]",
    eyebrow: "text-xs font-semibold uppercase tracking-[0.18em]",
    muted: "text-[#5B6170]",
    hairline: "border-[#E7E8EC]",
    surface: "bg-[#F5F6F8]",
    container: "mx-auto w-full max-w-[1320px] px-5 @3xl:px-10 @6xl:px-14",
    btnPrimary: `${BASE_BTN} rounded-full px-6 py-3 text-sm font-semibold bg-[var(--site-accent)] text-[var(--site-on-accent)] hover:brightness-110 hover:-translate-y-px shadow-[0_10px_30px_-12px_var(--site-accent)]`,
    btnGhost: `${BASE_BTN} rounded-full px-6 py-3 text-sm font-semibold border border-[#0B0D12]/15 hover:border-[#0B0D12]/40`,
    btnOnImage: `${BASE_BTN} rounded-full px-6 py-3 text-sm font-semibold border border-white/40 text-white backdrop-blur-sm bg-white/5 hover:bg-white/15`,
    imgRadius: "rounded-2xl",
    navLink: "text-sm font-medium",
  },
  luxury: {
    id: "luxury",
    dark: true,
    root: "bg-[#0E0D0C] text-[#EDE7DE]",
    bodyFont: "'SiteInter', ui-sans-serif, system-ui, sans-serif",
    displayFont: "'SiteCormorant', 'Cormorant Garamond', Georgia, serif",
    display: "font-medium tracking-[-0.01em]",
    eyebrow: "text-[11px] font-normal uppercase tracking-[0.32em]",
    muted: "text-[#A59F95]",
    hairline: "border-white/10",
    surface: "bg-[#171513]",
    container: "mx-auto w-full max-w-[1360px] px-6 @3xl:px-12 @6xl:px-20",
    btnPrimary: `${BASE_BTN} px-8 py-3.5 text-[11px] uppercase tracking-[0.28em] bg-[var(--site-accent)] text-[var(--site-on-accent)] hover:brightness-110`,
    btnGhost: `${BASE_BTN} px-8 py-3.5 text-[11px] uppercase tracking-[0.28em] border border-[var(--site-accent)]/60 text-[#EDE7DE] hover:bg-[var(--site-accent)]/10`,
    btnOnImage: `${BASE_BTN} px-8 py-3.5 text-[11px] uppercase tracking-[0.28em] border border-white/40 text-white hover:bg-white/10`,
    imgRadius: "rounded-none",
    navLink: "text-[11px] uppercase tracking-[0.28em]",
  },
  minimal: {
    id: "minimal",
    dark: false,
    root: "bg-white text-[#171717]",
    bodyFont: "'SiteNunito', 'SiteInter', ui-sans-serif, system-ui, sans-serif",
    displayFont: "'SiteInter', ui-sans-serif, system-ui, sans-serif",
    display: "font-normal tracking-[-0.03em]",
    eyebrow: "text-[11px] font-normal uppercase tracking-[0.2em]",
    muted: "text-[#737373]",
    hairline: "border-[#EBEBEB]",
    surface: "bg-[#F6F5F3]",
    container: "mx-auto w-full max-w-[1240px] px-6 @3xl:px-12 @6xl:px-16",
    btnPrimary: `${BASE_BTN} px-0 py-1 text-sm font-semibold border-b border-current hover:gap-3`,
    btnGhost: `${BASE_BTN} px-0 py-1 text-sm text-[#737373] border-b border-transparent hover:border-current hover:text-[#171717]`,
    btnOnImage: `${BASE_BTN} px-0 py-1 text-sm font-semibold border-b border-white text-white`,
    imgRadius: "rounded-none",
    navLink: "text-[13px]",
  },
};

export function siteVars(view: SiteView, preview: boolean, device: "desktop" | "mobile" = "desktop"): CSSProperties {
  const theme = SITE_THEMES[view.template];
  return {
    "--site-accent": view.colors.accent,
    "--site-on-accent": view.colors.onAccent,
    "--site-primary": view.colors.primary,
    // Hero height: real viewport on the live site, a fixed artboard height in the editor preview.
    "--site-hero-h": preview ? (device === "mobile" ? "680px" : "760px") : "max(560px, 92svh)",
    fontFamily: theme.bodyFont,
  } as CSSProperties;
}

export function DisplayHeading({
  as: Tag = "h2",
  theme,
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  theme: SiteTheme;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn(theme.display, className)} style={{ fontFamily: theme.displayFont }}>
      {children}
    </Tag>
  );
}

/** Plain <img> — portfolio URLs are authorizing redirect endpoints, not static files. */
export function SiteImg({
  src,
  alt,
  className,
  eager,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />;
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "S").slice(0, 2)).toUpperCase();
}

export function SocialIcon({ k, className }: { k: string; className?: string }) {
  const p: Record<string, ReactNode> = {
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </>
    ),
    facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8a1 1 0 0 1 1-1z" />,
    youtube: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
      </>
    ),
    linkedin: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7.5 10v7M7.5 7v.01M11.5 17v-4a2 2 0 0 1 4 0v4M11.5 10v7" />
      </>
    ),
    tiktok: <path d="M14 3v11a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.5" />,
    vimeo: <path d="M3 8.5c2-1.8 3.5-3 4.5-3 1.5 0 2 2.5 2.5 5.5.5 2.5 1 4 1.5 4 .8 0 2.5-2.5 3.5-5 .5-1.5-.2-2.5-1.5-2 .8-3 3-4.5 5-4.3 1.5.2 2 1.5 1.6 3.5-.8 4-6.5 11.3-9.6 11.3-2.3 0-3-4.5-4-8.5-.4-1.5-.8-2-1.5-1.5L3.8 9.6z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {p[k] ?? null}
    </svg>
  );
}
