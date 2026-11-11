"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelsTopLeft, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInAdminAppShell, useShellPageTitle } from "@/components/admin/app-shell/admin-app-shell-context";
import { SITES_TAB_COOKIE, type SitesTab } from "@/lib/sites-tabs";

const TABS: { key: SitesTab; href: string; label: string; short: string; icon: typeof Store }[] = [
  { key: "business", href: "/admin/sites/business", label: "Business Website", short: "Business", icon: Store },
  { key: "property", href: "/admin/sites/property", label: "Property Websites", short: "Property", icon: PanelsTopLeft },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Sites tabs (compact segmented control; Classic also shows an in-page heading). Publishes its bottom edge as
 * `--sites-header-bottom` so the full-height Business Website editor can sit right below it.
 * Remembers the last tab (cookie) so /admin/sites reopens where the owner left off.
 */
export function SitesHeader() {
  const pathname = usePathname() ?? "";
  const ref = useRef<HTMLDivElement>(null);
  const inAppShell = useInAdminAppShell();
  // New interface: "Sites" + subtitle live in the top bar.
  useShellPageTitle(inAppShell ? { title: "Sites", description: "Manage your business and property websites." } : null, pathname);
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
    <div ref={ref} className="min-w-0 pb-3">
      {inAppShell ? null : (
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">Sites</h1>
          <p className="mt-1 text-sm text-muted">Manage your business and property websites.</p>
        </div>
      )}
      <nav aria-label="Sites" className="min-w-0">
        <ul className="inline-flex max-w-full rounded-xl border border-border bg-subtle p-1">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const Icon = tab.icon;
            return (
              <li key={tab.key} className="min-w-0">
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-9 min-w-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:px-4",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    isActive ? "bg-card text-accent shadow-sm ring-1 ring-border" : "text-muted hover:text-heading"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-muted")} aria-hidden />
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
