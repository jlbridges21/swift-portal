"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteView } from "@/lib/website/view";
import { SiteNavProvider } from "@/components/website/site-ui";
import { SiteHome } from "@/components/website/site-home";
import { SiteAbout, SiteContact, SitePortfolio, SiteProject, SiteRequest, SiteServices } from "@/components/website/site-pages";
import { SiteRequestForm } from "@/components/website/site-request-form";

export type PreviewPage = { key: "home" | "portfolio" | "services" | "about" | "contact" | "request" } | { key: "project"; slug: string };

export function previewPageFromHref(href: string): PreviewPage | null {
  const path = href.split("?")[0]!.split("#")[0]!.replace(/\/$/, "") || "/";
  if (path === "/") return { key: "home" };
  if (path === "/portfolio") return { key: "portfolio" };
  if (path === "/services") return { key: "services" };
  if (path === "/contact") return { key: "contact" };
  if (path === "/about") return { key: "about" };
  if (path === "/request") return { key: "request" };
  const m = path.match(/^\/portfolio\/([a-z0-9-]+)$/);
  if (m) return { key: "project", slug: m[1]! };
  return null;
}

const WIDTH = { desktop: 1280, mobile: 390 } as const;
const PAD = 24;

/**
 * Live preview of the Business Website. Renders the real templates (container queries make the
 * desktop and mobile artboards lay out exactly like the live site), scaled to fit the pane.
 * Links inside the preview navigate the preview; forms never submit.
 */
export function WebsitePreview({
  view,
  page,
  onPageChange,
  instantPreliminaryEstimate,
  statusLabel,
  statusTone,
  liveUrl,
}: {
  view: SiteView;
  page: PreviewPage;
  onPageChange: (p: PreviewPage) => void;
  instantPreliminaryEstimate: boolean;
  statusLabel: string;
  statusTone: "live" | "draft" | "classic";
  liveUrl: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mobileOpen, setMobileOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const [height, setHeight] = useState(900);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.max(0, el.clientWidth - PAD * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobileOpen]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight || 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const width = WIDTH[device];
  const scale = avail > 0 ? Math.min(1, avail / width) : 0;

  const go = (href: string) => {
    const next = previewPageFromHref(href);
    if (!next) return;
    if (next.key === "project" && !view.portfolio.some((p) => p.slug === next.slug)) return;
    onPageChange(next);
    measureRef.current?.scrollTo({ top: 0 });
  };

  const project = page.key === "project" ? view.portfolio.find((p) => p.slug === page.slug) ?? null : null;
  const form = <SiteRequestForm template={view.template} instantPreliminaryEstimate={instantPreliminaryEstimate} signedInClient={null} portalOrigin={null} disabled />;

  let content: React.ReactNode;
  if (page.key === "portfolio") content = <SitePortfolio view={view} preview device={device} />;
  else if (page.key === "services") content = <SiteServices view={view} preview device={device} />;
  else if (page.key === "about" && view.about) content = <SiteAbout view={view} preview device={device} />;
  else if (page.key === "contact") content = <SiteContact view={view} form={form} preview device={device} />;
  else if (page.key === "request") content = <SiteRequest view={view} form={form} />;
  else if (page.key === "project" && project) content = <SiteProject view={view} project={project} preview device={device} />;
  else content = <SiteHome view={view} preview device={device} />;

  const tabs: { label: string; page: PreviewPage; show: boolean }[] = [
    { label: "Home", page: { key: "home" }, show: true },
    { label: "Portfolio", page: { key: "portfolio" }, show: view.portfolio.length > 0 },
    { label: "Services", page: { key: "services" }, show: view.allServices.length > 0 },
    { label: "About", page: { key: "about" }, show: Boolean(view.about) },
    { label: "Contact", page: { key: "contact" }, show: true },
  ];

  const frame = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white max-lg:h-[min(75dvh,44rem)] max-lg:rounded-xl max-lg:border max-lg:border-border">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Preview pages">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => go(t.page.key === "home" ? "/" : `/${t.page.key}`)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  page.key === t.page.key || (t.page.key === "portfolio" && page.key === "project") ? "bg-accent/10 text-heading" : "text-muted hover:text-heading"
                )}
              >
                {t.label}
              </button>
            ))}
          {view.portfolio.length ? (
            <select
              aria-label="Preview a portfolio project"
              className="h-8 max-w-[11rem] rounded-md border border-border bg-white px-2 text-xs text-heading surface-dark:bg-card"
              value={page.key === "project" ? page.slug : ""}
              onChange={(e) => e.target.value && go(`/portfolio/${e.target.value}`)}
            >
              <option value="">Project page…</option>
              {view.portfolio.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : null}
        </nav>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-label={d === "desktop" ? "Desktop preview" : "Mobile preview"}
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={cn("rounded-md p-1.5", device === d ? "bg-accent/10 text-heading" : "text-muted hover:text-heading")}
            >
              {d === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-[#F1F5F9] px-3 py-1.5">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusTone === "live" ? "bg-emerald-100 text-emerald-900" : statusTone === "draft" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusTone === "live" ? "bg-emerald-500" : statusTone === "draft" ? "bg-amber-500" : "bg-slate-500")} />
          {statusLabel}
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-white px-2 py-0.5 text-[11px] text-muted">
          {liveUrl.replace(/^https?:\/\//, "")}
          {page.key === "home" ? "/" : page.key === "project" ? `/portfolio/${page.slug}` : `/${page.key}`}
        </span>
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
          Open live <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div ref={measureRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#E2E8F0] p-6">
        <div
          className={cn("mx-auto overflow-hidden bg-white shadow-md", device === "mobile" ? "rounded-[28px] ring-8 ring-[#0F172A]" : "rounded-md border border-border")}
          style={{ width: width * (scale || 0.01), height: Math.max(1, height * (scale || 0.01)) }}
        >
          <div ref={contentRef} style={{ width, transform: scale > 0 ? `scale(${scale})` : undefined, transformOrigin: "top left" }}>
            <SiteNavProvider preview navigate={go}>
              {content}
            </SiteNavProvider>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
        <p className="text-sm font-medium text-heading">Website preview</p>
        <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1", !mobileOpen && "hidden lg:flex lg:flex-col")}>{frame}</div>
    </div>
  );
}
