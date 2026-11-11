"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelsTopLeft, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITES_TAB_COOKIE, type SitesTab } from "@/lib/sites-tabs";

const TABS: { key: SitesTab; href: string; label: string; short: string; icon: typeof Store }[] = [
  { key: "business", href: "/admin/sites/business", label: "Business Website", short: "Business", icon: Store },
  { key: "property", href: "/admin/sites/property", label: "Property Websites", short: "Property", icon: PanelsTopLeft },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Sites page heading + the two equal-width tabs. Publishes its bottom edge as
 * `--sites-header-bottom` so the full-height Business Website editor can sit right below it.
 * Remembers the last tab (cookie) so /admin/sites reopens where the owner left off.
 */
export function SitesHeader() {
  const pathname = usePathname() ?? "";
  const ref = useRef<HTMLDivElement>(null);
  const active = TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.key ?? null;

  useEffect(() => {
    if (!active) return;
    document.cookie = `${SITES_TAB_COOKIE}=${active}; path=/admin; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  }, [active]);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--sites-header-bottom", `${Math.round(el.getBoundingClientRect().bottom + window.scrollY)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      root.style.removeProperty("--sites-header-bottom");
    };
  }, []);

  return (
    <div ref={ref} className="min-w-0 pb-4 lg:pb-5">
      <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">Sites</h1>
      <p className="mt-1 text-sm text-muted">Manage your business website and property websites.</p>
      <nav aria-label="Sites" className="mt-4 lg:mt-5">
        <ul className="grid grid-cols-2 gap-2 sm:gap-3">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const Icon = tab.icon;
            return (
              <li key={tab.key} className="min-w-0">
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors sm:min-h-[3.25rem] sm:gap-3 sm:text-base",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
                    isActive
                      ? "border-accent bg-accent text-white shadow-sm shadow-accent/25"
                      : "border-border bg-card text-heading hover:border-accent/40 hover:bg-accent-subtle/40"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-muted")} aria-hidden />
                  <span className="truncate sm:hidden">{tab.short}</span>
                  <span className="hidden truncate sm:inline">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
