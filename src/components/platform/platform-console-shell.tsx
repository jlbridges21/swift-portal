"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  Calculator,
  ChartColumn,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ScrollText,
  Sparkles,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_ICONS } from "@/lib/site-metadata";
import {
  CONSOLE_GROUPS,
  CONSOLE_SIDEBAR_COOKIE,
  activeConsoleSection,
  consoleTabsFor,
  routeTabActive,
  type ConsoleIcon,
  type ConsoleTab,
} from "@/lib/platform-console-nav";

const ICONS: Record<ConsoleIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  "new-business": Building2,
  revenue: Receipt,
  economics: Calculator,
  plans: Tags,
  analytics: ChartColumn,
  partners: Handshake,
  lifecycle: MailCheck,
  w9: FileText,
  rollout: Sparkles,
  audit: ScrollText,
};

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 72;

/**
 * Super-admin console frame: dark left sidebar (primary sections) + sticky top bar with the
 * active section's tabs. Page content renders unchanged in the main column.
 *
 * CSS variables exposed to descendants (used by a couple of sticky/fixed page elements):
 *   --platform-sidebar-w   current desktop sidebar width
 *   --platform-sticky-top  height of the sticky header (impersonation banner + top bar)
 */
export function PlatformConsoleShell({
  initialCollapsed,
  banner,
  children,
}: {
  initialCollapsed: boolean;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/platform";
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${CONSOLE_SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/platform; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock page scroll and allow Escape while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // Publish the sticky header height so in-page sticky bars can sit below it.
  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;
    const apply = () => root.style.setProperty("--platform-sticky-top", `${header.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const section = activeConsoleSection(pathname);
  const tabs = consoleTabsFor(pathname);
  const SectionIcon = section ? ICONS[section.icon] : null;

  return (
    <div
      ref={rootRef}
      data-platform-console=""
      className="flex min-h-dvh"
      style={{ ["--platform-sidebar-w" as string]: `${collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W}px` }}
    >
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 z-40 hidden h-dvh shrink-0 transition-[width] duration-200 ease-out md:block"
        style={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
        aria-label="Platform console"
      >
        <SidebarBody pathname={pathname} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Platform console navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <SidebarBody pathname={pathname} collapsed={false} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={headerRef} className="sticky top-0 z-30">
          {banner}
          <div className="border-b border-border bg-card">
            <div className="flex min-h-14 items-center gap-3 px-3 sm:px-5">
              <button
                type="button"
                className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading md:hidden"
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {SectionIcon ? <SectionIcon className="hidden h-4 w-4 text-muted sm:block" aria-hidden /> : null}
                <span className="text-[15px] font-semibold text-heading">
                  {tabs?.context ?? section?.label ?? "Platform console"}
                </span>
              </div>
              {tabs ? (
                <>
                  <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
                  <Suspense fallback={<div className="h-14 flex-1" />}>
                    <TopTabs pathname={pathname} tabs={tabs.tabs} ariaLabel={tabs.ariaLabel} />
                  </Suspense>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function SidebarBody({
  pathname,
  collapsed,
  onToggleCollapsed,
  onClose,
}: {
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-white/10", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/platform" className="flex min-w-0 items-center gap-3" title={collapsed ? "ShootPortal Platform Console" : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE_ICONS.icon192} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
          {!collapsed ? (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">ShootPortal</span>
              <span className="block truncate text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                Platform console
              </span>
            </span>
          ) : null}
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Sections */}
      <nav aria-label="Platform sections" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {CONSOLE_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            {collapsed ? (
              gi > 0 ? <div className="mx-2 mb-3 border-t border-white/10" aria-hidden /> : null
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.sections.map((s) => {
                const Icon = ICONS[s.icon];
                const active = s.match(pathname);
                return (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? s.label : undefined}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-0" : "px-3",
                        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />
                      ) : null}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-slate-500 group-hover:text-slate-300")} aria-hidden />
                      {collapsed ? <span className="sr-only">{s.label}</span> : <span className="truncate">{s.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-0.5 border-t border-white/10 px-3 py-3">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
          </button>
        </form>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const tabClass = (active: boolean) =>
  cn(
    "relative inline-flex h-14 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors",
    active ? "text-accent" : "text-muted hover:text-heading"
  );

function ActiveBar() {
  return <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />;
}

function TopTabs({ pathname, tabs, ariaLabel }: { pathname: string; tabs: ConsoleTab[]; ariaLabel: string }) {
  const params = useSearchParams();
  const hash = useLocationHash(pathname);

  return (
    <nav aria-label={ariaLabel} className="-mb-px flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        if (t.kind === "route") {
          const active = routeTabActive(t, pathname);
          let href = t.href;
          if (t.preserveQuery?.length) {
            const keep = new URLSearchParams();
            for (const k of t.preserveQuery) {
              const v = params?.get(k);
              if (v) keep.set(k, v);
            }
            if (keep.toString()) href = `${href}?${keep}`;
          }
          return (
            <Link key={t.href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              {t.label}
              {active ? <ActiveBar /> : null}
            </Link>
          );
        }
        const current = hash.replace(/^#/, "");
        const active = current ? current === t.hash || current.startsWith(`${t.hash}-`) : Boolean(t.isDefault);
        return (
          <a
            key={t.hash}
            href={`#${t.hash}`}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
            onClick={(e) => {
              // Same behaviour as the old in-page section nav: swap the hash without jumping,
              // then let the page's hashchange listener switch the panel.
              e.preventDefault();
              window.history.replaceState(window.history.state, "", `#${t.hash}`);
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }}
          >
            {t.label}
            {active ? <ActiveBar /> : null}
          </a>
        );
      })}
    </nav>
  );
}

/** location.hash, re-read on hashchange and on every route change (Next navigations don't fire it). */
function useLocationHash(pathname: string): string {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);
  return hash;
}
