"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import type { SitePageKey, SiteView } from "@/lib/website/view";
import { cn } from "@/lib/utils";
import { SITE_THEMES, SiteImg, SiteLink, SocialIcon, WebsiteStyles, siteVars, useSiteNav, type SiteTheme } from "@/components/website/site-ui";

function Brand({ view, theme, onImage, size = "md" }: { view: SiteView; theme: SiteTheme; onImage: boolean; size?: "md" | "lg" }) {
  const logo = view.business.logoUrl;
  const h = size === "lg" ? "h-12 @3xl:h-14" : "h-9 @3xl:h-10";
  return (
    <SiteLink href="/" ariaLabel={`${view.business.name} home`} className="flex min-w-0 items-center gap-3">
      {logo ? (
        <SiteImg
          src={logo}
          alt={view.business.name}
          eager
          className={cn(
            h,
            "w-auto max-w-[200px] object-contain",
            // drop-shadow follows the logo's shape (transparent pixels cast no shadow) — never a box.
            onImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]" : "drop-shadow-[0_1px_4px_rgba(0,0,0,0.22)]"
          )}
        />
      ) : (
        <span
          className={cn(
            "truncate",
            theme.id === "luxury" ? "text-2xl tracking-[0.04em]" : theme.id === "minimal" ? "text-[15px] font-semibold tracking-[-0.01em]" : "text-lg font-bold tracking-[-0.02em]"
          )}
          style={{ fontFamily: theme.displayFont }}
        >
          {view.business.name}
        </span>
      )}
    </SiteLink>
  );
}

function SiteHeader({ view, theme, page, overlay }: { view: SiteView; theme: SiteTheme; page: SitePageKey | "project" | "request"; overlay: boolean }) {
  const [open, setOpen] = useState(false);
  const { preview } = useSiteNav();
  const onImage = overlay && !open;
  const active = (k: SitePageKey) => page === k || (k === "portfolio" && page === "project");
  const navItems = view.nav.filter((n) => n.key !== "home" || theme.id !== "minimal");

  // Letter-spaced luxury navigation needs more room before it collapses into the menu.
  const wide = theme.id === "luxury";
  const linkCls = (k: SitePageKey) =>
    cn(
      theme.navLink,
      "relative whitespace-nowrap transition-opacity duration-200",
      onImage ? "text-white/85 hover:text-white" : theme.dark ? "text-[#EDE7DE]/70 hover:text-[#EDE7DE]" : "text-current opacity-70 hover:opacity-100",
      active(k) && (onImage ? "text-white" : "opacity-100 text-current"),
      active(k) && theme.id === "minimal" && "underline underline-offset-[6px] decoration-1",
      active(k) && theme.id === "modern" && "after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-full after:bg-[var(--site-accent)]",
      active(k) && theme.id === "luxury" && "text-[var(--site-accent)]"
    );

  const cta = (
    <SiteLink href={view.links.request} className={onImage && theme.id === "minimal" ? theme.btnOnImage : theme.btnPrimary}>
      {view.cta.label}
    </SiteLink>
  );

  return (
    <header
      className={cn(
        "z-40 w-full",
        overlay ? "absolute inset-x-0 top-0" : preview ? "relative" : "sticky top-0",
        !overlay && (theme.dark ? "bg-[#0E0D0C]/90 backdrop-blur-md" : "bg-white/90 backdrop-blur-md"),
        !overlay && "border-b",
        !overlay && theme.hairline,
        overlay && !open && "bg-gradient-to-b from-black/55 via-black/20 to-transparent text-white",
        open && (theme.dark ? "bg-[#0E0D0C]" : "bg-white")
      )}
    >
      <div className={cn(theme.container, "flex items-center justify-between gap-6", theme.id === "luxury" ? "h-24" : "h-[76px]")}>
        <Brand view={view} theme={theme} onImage={onImage} />
        <nav aria-label="Main" className={cn("hidden items-center", wide ? "gap-7 @6xl:flex" : "gap-8 @4xl:flex")}>
          {navItems.map((n) => (
            <SiteLink key={n.key} href={n.href} className={linkCls(n.key)}>
              {n.label}
            </SiteLink>
          ))}
          {view.links.showClientLogin ? (
            <SiteLink
              href={view.links.clientLogin}
              className={cn(theme.navLink, "whitespace-nowrap", onImage ? "text-white/70 hover:text-white" : "opacity-60 hover:opacity-100")}
            >
              Client Login
            </SiteLink>
          ) : null}
          {cta}
        </nav>
        <button
          type="button"
          className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center", wide ? "@6xl:hidden" : "@4xl:hidden", onImage ? "text-white" : "text-current")}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className={cn("border-t", wide ? "@6xl:hidden" : "@4xl:hidden", theme.hairline, theme.dark ? "bg-[#0E0D0C] text-[#EDE7DE]" : "bg-white text-[#111]")}>
          <nav aria-label="Mobile" className={cn(theme.container, "flex flex-col py-4")}>
            {view.nav.map((n) => (
              <SiteLink
                key={n.key}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn("border-b py-4 text-2xl", theme.hairline, active(n.key) ? "text-[var(--site-accent)]" : "")}
              >
                <span style={{ fontFamily: theme.displayFont }}>{n.label}</span>
              </SiteLink>
            ))}
            {view.links.showClientLogin ? (
              <SiteLink href={view.links.clientLogin} onClick={() => setOpen(false)} className={cn("border-b py-4 text-base", theme.hairline, theme.muted)}>
                Client Login
              </SiteLink>
            ) : null}
            <div className="pt-6 pb-2">
              <SiteLink href={view.links.request} onClick={() => setOpen(false)} className={cn(theme.id === "minimal" ? theme.btnPrimary : theme.btnPrimary, "w-full")}>
                {view.cta.label}
              </SiteLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function SiteFooter({ view, theme }: { view: SiteView; theme: SiteTheme }) {
  const b = view.business;
  const year = new Date().getFullYear();
  const dark = theme.id !== "minimal";
  const muted = dark ? "text-white/55" : theme.muted;
  const contact = [
    b.email ? { label: b.email, href: `mailto:${b.email}` } : null,
    b.phone ? { label: b.phone, href: b.phoneHref || "" } : null,
  ].filter((x): x is { label: string; href: string } => Boolean(x));

  if (theme.id === "minimal") {
    return (
      <footer className={cn("border-t", theme.hairline)}>
        <div className={cn(theme.container, "flex flex-col gap-8 py-14 @4xl:flex-row @4xl:items-end @4xl:justify-between")}>
          <div className="space-y-3">
            <p className="text-[15px] font-semibold">{b.name}</p>
            {contact.map((c) =>
              c.href ? (
                <SiteLink key={c.label} href={c.href} className={cn("block text-sm", theme.muted, "hover:text-[#171717]")}>
                  {c.label}
                </SiteLink>
              ) : (
                <p key={c.label} className={cn("text-sm", theme.muted)}>
                  {c.label}
                </p>
              )
            )}
            {b.addressLines.length ? <p className={cn("text-sm", theme.muted)}>{b.addressLines.join(" · ")}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
            {view.nav.map((n) => (
              <SiteLink key={n.key} href={n.href} className={cn(theme.muted, "hover:text-[#171717]")}>
                {n.label}
              </SiteLink>
            ))}
            {view.links.showClientLogin ? (
              <SiteLink href={view.links.clientLogin} className={cn(theme.muted, "hover:text-[#171717]")}>
                Client Login
              </SiteLink>
            ) : null}
            {b.social.map((s) => (
              <SiteLink key={s.key} href={s.url}
                  newTab ariaLabel={s.label} className={cn(theme.muted, "hover:text-[#171717]")}>
                <SocialIcon k={s.key} className="h-4 w-4" />
              </SiteLink>
            ))}
          </div>
        </div>
        <div className={cn(theme.container, "flex flex-wrap gap-x-5 gap-y-2 pb-10 text-xs", theme.muted)}>
          <span>
            © {year} {b.legalName}
          </span>
          {b.privacyUrl ? <SiteLink href={b.privacyUrl}>Privacy</SiteLink> : null}
          {b.termsUrl ? <SiteLink href={b.termsUrl}>Terms</SiteLink> : null}
        </div>
      </footer>
    );
  }

  return (
    <footer className={cn(theme.id === "luxury" ? "border-t border-white/10 bg-[#0A0908]" : "bg-[#0B0D12]", "text-white")}>
      <div className={cn(theme.container, "grid gap-12 py-16 @3xl:grid-cols-[1.4fr_1fr_1fr] @3xl:py-20")}>
        <div className="space-y-5">
          <Brand view={view} theme={theme} onImage={false} size="lg" />
          {b.tagline ? <p className={cn("max-w-sm text-sm leading-relaxed", muted)}>{b.tagline}</p> : null}
          {b.social.length ? (
            <div className="flex gap-2">
              {b.social.map((s) => (
                <SiteLink
                  key={s.key}
                  href={s.url}
                  newTab
                  ariaLabel={s.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-[var(--site-accent)] hover:text-white"
                >
                  <SocialIcon k={s.key} className="h-[18px] w-[18px]" />
                </SiteLink>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className={cn(theme.eyebrow, "text-white/40")}>Explore</p>
          <ul className="mt-5 space-y-3 text-sm">
            {view.nav.map((n) => (
              <li key={n.key}>
                <SiteLink href={n.href} className="text-white/75 transition hover:text-white">
                  {n.label}
                </SiteLink>
              </li>
            ))}
            <li>
              <SiteLink href={view.links.request} className="text-white/75 transition hover:text-white">
                {view.cta.label}
              </SiteLink>
            </li>
            {view.links.showClientLogin ? (
              <li>
                <SiteLink href={view.links.clientLogin} className="inline-flex items-center gap-1 text-white/75 transition hover:text-white">
                  Client Login <ArrowUpRight className="h-3.5 w-3.5" />
                </SiteLink>
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className={cn(theme.eyebrow, "text-white/40")}>Get in touch</p>
          <ul className="mt-5 space-y-3 text-sm">
            {contact.map((c) => (
              <li key={c.label}>
                {c.href ? (
                  <SiteLink href={c.href} className="text-white/75 transition hover:text-white">
                    {c.label}
                  </SiteLink>
                ) : (
                  <span className="text-white/75">{c.label}</span>
                )}
              </li>
            ))}
            {b.addressLines.map((line) => (
              <li key={line} className="text-white/55">
                {line}
              </li>
            ))}
            {!contact.length && !b.addressLines.length ? (
              <li>
                <SiteLink href="/contact" className="text-white/75 transition hover:text-white">
                  Send us a message
                </SiteLink>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className={cn(theme.container, "flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-white/40")}>
          <span>
            © {year} {b.legalName}. All rights reserved.
          </span>
          <span className="flex gap-5">
            {b.privacyUrl ? (
              <SiteLink href={b.privacyUrl} className="hover:text-white/70">
                Privacy
              </SiteLink>
            ) : null}
            {b.termsUrl ? (
              <SiteLink href={b.termsUrl} className="hover:text-white/70">
                Terms
              </SiteLink>
            ) : null}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Full page frame: fonts, theme variables, header, content, footer. */
export function SiteShell({
  view,
  page,
  overlayHeader = false,
  preview = false,
  device = "desktop",
  children,
}: {
  view: SiteView;
  page: SitePageKey | "project" | "request";
  overlayHeader?: boolean;
  preview?: boolean;
  device?: "desktop" | "mobile";
  children: ReactNode;
}) {
  const theme = SITE_THEMES[view.template];
  return (
    <div className={cn("@container relative flex min-h-full flex-col antialiased", theme.root)} style={siteVars(view, preview, device)} data-site-template={view.template} data-site-preview={preview ? "" : undefined}>
      <WebsiteStyles />
      <SiteHeader view={view} theme={theme} page={page} overlay={overlayHeader} />
      <main className="flex-1">{children}</main>
      <SiteFooter view={view} theme={theme} />
    </div>
  );
}
