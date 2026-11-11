"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  FolderKanban,
  Handshake,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  PanelsTopLeft,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAdminSearch } from "@/components/admin/admin-search-context";
import { useAdminCapabilities } from "@/components/admin/admin-capabilities-context";
import {
  AdminAppShellContext,
  AdminPageTitleContext,
  type AdminPageTitleStore,
  type AdminShellUser,
  type ShellPageTitle,
} from "@/components/admin/app-shell/admin-app-shell-context";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";
import { appParentPath } from "@/lib/pwa/app-nav";
import { cn } from "@/lib/utils";
import { SitesTabs, isSitesPath } from "@/components/admin/sites/sites-tab-nav";
import { UiRolloutBanner, useSwitchInterface, useUiRollout } from "@/components/admin/ui-rollout/ui-rollout";
import type { StaffArea } from "@/lib/staff-access";

type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  match: (pathname: string) => boolean;
  badge?: number;
};

const STAFF_AREA_HOME: Record<StaffArea, string> = {
  projects: "/admin/projects",
  clients: "/admin/clients",
  media: "/admin/media",
  calendar: "/admin/calendar",
  messages: "/admin/messages",
};

const prefix = (href: string) => (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Full-screen editors bring their own chrome (same routes the mobile tab bar steps aside for). */
function isFullScreenRoute(pathname: string): boolean {
  return /^\/admin\/projects\/[^/]+\/marketing(\/|$)/.test(pathname) || pathname.startsWith("/admin/photo-editor/");
}

/**
 * Top-bar title before (or without) a page publishing its own. Rendered on the server, so the
 * header never flashes empty; pages add live counts via PageHeader / useShellPageTitle.
 */
function routePageTitle(pathname: string, isStaff: boolean): ShellPageTitle {
  const p = pathname.replace(/\/+$/, "") || "/";
  const projects = { label: "Projects", href: "/admin/projects" };
  const clients = { label: "Clients", href: "/admin/clients" };
  if (p === "/admin") return { title: "Command Center" };
  if (p === "/admin/projects/new") return { title: "New Project", crumbs: [projects] };
  if (p.startsWith("/admin/projects/")) return { title: "Project", crumbs: [projects] };
  if (p.startsWith("/admin/projects")) return { title: "Project Pipeline" };
  if (p.startsWith("/admin/media")) return { title: "Media Library" };
  if (p.startsWith("/admin/messages")) return { title: "Messages", description: "Conversations with your clients" };
  if (p.startsWith("/admin/calendar")) return { title: "Shoot Calendar" };
  if (p === "/admin/clients/new") return { title: "New Client", crumbs: [clients] };
  if (p.startsWith("/admin/clients/")) return { title: "Client", crumbs: [clients] };
  if (p.startsWith("/admin/clients")) return { title: "Clients" };
  if (p.startsWith("/admin/sites")) return { title: "Sites", description: "Manage your business and property websites." };
  if (p.startsWith("/admin/settings")) return { title: "Settings", description: "Business settings" };
  if (p.startsWith("/admin/leads")) return { title: "Leads" };
  if (p.startsWith("/partner")) return { title: "Partner", description: "ShootPortal Partner Program" };
  if (p.startsWith("/staff/settings")) return { title: "Preferences" };
  return { title: isStaff ? "ShootPortal" : "Command Center" };
}

/**
 * Business app frame: persistent left sidebar (primary navigation, Settings and the profile
 * pinned to the bottom) and a slim top bar (search, notifications, profile). Page content
 * renders unchanged in the main column and scrolls with the document, so existing sticky
 * elements keep working.
 *
 *   ≥1024px  full sidebar (240px)
 *   768–1023 icon rail (72px)
 *   <768     no sidebar: top bar menu opens a drawer; the installed-app bottom tab bar stays
 *
 * Width is exposed as --admin-sidebar-w (globals.css) for fixed full-screen page panels.
 */
export function AdminAppShell({
  user,
  banner,
  children,
}: {
  user?: AdminShellUser | null;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const caps = useAdminCapabilities();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [registeredTitle, setRegisteredTitle] = useState<AdminPageTitleStore["registered"]>(null);
  const setTitle = useCallback((reg: NonNullable<AdminPageTitleStore["registered"]>) => setRegisteredTitle(reg), []);
  const clearTitle = useCallback((id: number) => setRegisteredTitle((cur) => (cur?.id === id ? null : cur)), []);
  const titleStore = useMemo<AdminPageTitleStore>(
    () => ({ registered: registeredTitle, set: setTitle, clear: clearTitle }),
    [registeredTitle, setTitle, clearTitle]
  );
  const [messagesUnread, setMessagesUnread] = useState(0);

  const isStaff = caps.userRole === "staff";
  const capsStaffAreas = caps.staffAreas;
  const staffAreas = useMemo(() => (isStaff ? (capsStaffAreas ?? []) : null), [isStaff, capsStaffAreas]);

  const navItems = useMemo<NavItem[]>(() => {
    const allow = (area: StaffArea) => !staffAreas || staffAreas.includes(area);
    const items: NavItem[] = [];
    // Staff never see the business-wide Command Center, Partner, or Sites (owner-only surfaces).
    if (!isStaff) {
      items.push({ key: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/admin" });
    }
    if (allow("projects")) items.push({ key: "projects", href: "/admin/projects", label: "Projects", icon: FolderKanban, match: prefix("/admin/projects") });
    if (allow("media")) items.push({ key: "media", href: "/admin/media", label: "Media", icon: ImageIcon, match: prefix("/admin/media") });
    if (allow("messages")) {
      items.push({
        key: "messages",
        href: "/admin/messages",
        label: "Messages",
        icon: MessageSquare,
        match: prefix("/admin/messages"),
        badge: messagesUnread,
      });
    }
    if (allow("calendar")) items.push({ key: "calendar", href: "/admin/calendar", label: "Calendar", icon: Calendar, match: prefix("/admin/calendar") });
    if (allow("clients")) items.push({ key: "clients", href: "/admin/clients", label: "Clients", icon: Users, match: prefix("/admin/clients") });
    if (!isStaff && caps.showPartner) {
      items.push({ key: "partner", href: caps.partnerNavHref, label: "Partner", icon: Handshake, match: prefix("/partner") });
    }
    if (!isStaff) items.push({ key: "sites", href: "/admin/sites", label: "Sites", icon: PanelsTopLeft, match: prefix("/admin/sites") });
    return items;
  }, [isStaff, staffAreas, caps.showPartner, caps.partnerNavHref, messagesUnread]);

  const homeHref = isStaff ? (staffAreas?.[0] ? STAFF_AREA_HOME[staffAreas[0]] : "/staff") : "/admin";
  const settingsHref = isStaff ? "/staff/settings" : "/admin/settings";
  const settingsLabel = isStaff ? "Preferences" : "Settings";
  const canSeeMessages = !staffAreas || staffAreas.includes("messages");

  // Unread client messages: refreshed on every navigation (cheap count query).
  useEffect(() => {
    if (!canSeeMessages) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/messages?unread_count=1", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setMessagesUnread(Number(data.count) || 0);
      } catch {
        /* ignore — badge just stays as it was */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, canSeeMessages]);

  // Close the drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock page scroll and allow Escape while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (isFullScreenRoute(pathname)) {
    return (
      <AdminAppShellContext.Provider value={false}>
        {banner}
        {children}
      </AdminAppShellContext.Provider>
    );
  }

  const sidebarProps = {
    pathname,
    navItems,
    homeHref,
    settingsHref,
    settingsLabel,
    user: user ?? null,
    isStaff,
  };

  return (
    <AdminAppShellContext.Provider value={true}>
      <AdminPageTitleContext.Provider value={titleStore}>
      <div data-admin-app-shell="" className="flex min-h-[var(--app-height)] w-full bg-background">
        {/* Sidebar: icon rail on tablets, full on desktop. */}
        <aside
          aria-label="Main navigation"
          className="admin-app-sidebar sticky top-[var(--sat)] z-40 hidden h-[var(--app-height)] shrink-0 border-r border-border bg-card md:block"
        >
          <SidebarBody {...sidebarProps} variant="responsive" />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/40"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-card shadow-2xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <SidebarBody {...sidebarProps} variant="drawer" onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {banner}
          <TopBar
            homeHref={homeHref}
            user={user ?? null}
            settingsHref={settingsHref}
            settingsLabel={settingsLabel}
            isStaff={isStaff}
            drawerOpen={drawerOpen}
            onOpenDrawer={() => setDrawerOpen(true)}
            pageTitle={
              registeredTitle && registeredTitle.path === pathname ? registeredTitle : routePageTitle(pathname, isStaff)
            }
          />
          <UiRolloutBanner />
          <div data-admin-shell-content="" className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
      </AdminPageTitleContext.Provider>
    </AdminAppShellContext.Provider>
  );
}

function SidebarBody({
  pathname,
  navItems,
  homeHref,
  settingsHref,
  settingsLabel,
  user,
  isStaff,
  variant,
  onClose,
}: {
  pathname: string;
  navItems: NavItem[];
  homeHref: string;
  settingsHref: string;
  settingsLabel: string;
  user: AdminShellUser | null;
  isStaff: boolean;
  /** responsive: rail below lg, full at lg. drawer: always full. */
  variant: "responsive" | "drawer";
  onClose?: () => void;
}) {
  const full = variant === "drawer";
  // Labels: always in the drawer; only from lg in the persistent sidebar.
  const labelCls = full ? "truncate" : "hidden truncate lg:inline";
  const rowCls = full ? "px-3" : "justify-center px-0 lg:justify-start lg:px-3";
  const settingsActive = prefix(settingsHref)(pathname);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-14 shrink-0 items-center sm:h-16", full ? "px-4" : "justify-center px-2 lg:justify-start lg:px-5")}>
        {full ? (
          <Logo href={homeHref} size="sm" />
        ) : (
          <>
            <Logo href={homeHref} compact showText={false} className="lg:hidden" />
            <Logo href={homeHref} size="sm" className="hidden lg:flex" />
          </>
        )}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const badge = item.badge ?? 0;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={full ? undefined : item.label}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                    rowCls,
                    active
                      ? "bg-accent-subtle text-accent"
                      : "text-foreground hover:bg-subtle hover:text-heading"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-accent" : "text-muted group-hover:text-heading"
                    )}
                    aria-hidden
                  />
                  <span className={labelCls}>{item.label}</span>
                  {badge > 0 ? (
                    <>
                      {/* Full row: count pill. Rail: dot on the icon. */}
                      <span
                        className={cn(
                          "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground",
                          !full && "hidden lg:inline-flex"
                        )}
                        aria-label={`${badge} unread`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                      {!full ? (
                        <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-card lg:hidden" aria-hidden />
                      ) : null}
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-border px-3 py-3">
        <Link
          href={settingsHref}
          aria-current={settingsActive ? "page" : undefined}
          title={full ? undefined : settingsLabel}
          className={cn(
            "group flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
            rowCls,
            settingsActive ? "bg-accent-subtle text-accent" : "text-foreground hover:bg-subtle hover:text-heading"
          )}
        >
          <Settings
            className={cn("h-[18px] w-[18px] shrink-0", settingsActive ? "text-accent" : "text-muted group-hover:text-heading")}
            aria-hidden
          />
          <span className={labelCls}>{settingsLabel}</span>
        </Link>
        <div className="mt-2">
          <ProfileMenu
            user={user}
            isStaff={isStaff}
            settingsHref={settingsHref}
            settingsLabel={settingsLabel}
            trigger={full ? "row" : "responsive-row"}
            placement="top"
          />
        </div>
      </div>
    </div>
  );
}

function TopBar({
  homeHref,
  user,
  settingsHref,
  settingsLabel,
  isStaff,
  drawerOpen,
  onOpenDrawer,
  pageTitle,
}: {
  pageTitle: ShellPageTitle;
  homeHref: string;
  user: AdminShellUser | null;
  settingsHref: string;
  settingsLabel: string;
  isStaff: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { openSearch } = useAdminSearch();
  const [refreshing, setRefreshing] = useState(false);
  // Installed app on a phone: deeper screens get a native-style back button to their parent.
  const standaloneMobile = useIsStandalonePwaMobile();
  const backHref = standaloneMobile ? appParentPath(pathname) : null;
  const centerTabs = isSitesPath(pathname);

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <header className="app-sticky-top app-safe-x sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="flex h-14 w-full items-center gap-1.5 px-3 sm:h-16 sm:gap-3 sm:px-6">
        {/* Left: menu / back on phones, then the current page's title and subtitle. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-0">
          <div className="flex shrink-0 items-center md:hidden">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-heading active:bg-subtle"
            >
              <ChevronLeft className="h-6 w-6" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading hover:bg-subtle"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          )}
          </div>
          <TopBarTitle page={pageTitle} homeHref={homeHref} />
        </div>

        {/* Center slot (wide screens): Sites tabs. Narrower screens keep them in a row under the bar. */}
        {centerTabs ? <SitesTabs className="hidden shrink-0 xl:block" /> : null}

        <div className={cn("flex shrink-0 items-center gap-1.5 sm:gap-3", centerTabs && "xl:flex-1 xl:justify-end")}>
        {/* Search: full field from md, icon on phones. Opens the existing ⌘K palette. */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search projects, clients, or media (Command K)"
          className={cn(
            "hidden h-10 w-56 min-w-0 shrink items-center gap-2 rounded-full border border-border bg-subtle px-4 text-left text-sm text-muted transition hover:border-accent/40 hover:bg-card md:flex lg:w-72",
            centerTabs ? "xl:w-64 2xl:w-80" : "xl:w-96"
          )}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Search projects, clients, or media...</span>
          <kbd className="hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted lg:inline">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading hover:bg-subtle md:hidden"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>

        {/* Pull-to-refresh is missing in the installed app, so it gets a refresh button; browsers have their own. */}
        {standaloneMobile ? (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh page"
          title="Refresh"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading hover:bg-subtle md:hidden"
        >
          {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </button>
        ) : null}

        <div className="shrink-0">
          <NotificationBell />
        </div>

        <ProfileMenu
          user={user}
          isStaff={isStaff}
          settingsHref={settingsHref}
          settingsLabel={settingsLabel}
          trigger="avatar"
          placement="bottom"
        />
        </div>
      </div>
    </header>
  );
}

/** Page title (h1) with a muted subtitle or breadcrumb trail; the subtitle hides on phones. */
function TopBarTitle({ page, homeHref }: { page: ShellPageTitle; homeHref: string }) {
  const crumbs = page.crumbs ?? [];
  return (
    <div className="min-w-0 flex-1 md:pr-4" data-shell-page-title="">
      {crumbs.length ? (
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-xs text-muted sm:flex">
          {crumbs.map((c) => (
            <span key={c.href} className="flex min-w-0 items-center gap-1">
              <Link href={c.href} className="truncate hover:text-accent hover:underline">
                {c.label}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            </span>
          ))}
        </nav>
      ) : null}
      <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-heading sm:text-lg">
        {page.title || <Link href={homeHref}>ShootPortal</Link>}
      </h1>
      {!crumbs.length && page.description ? (
        <p className="hidden truncate text-xs leading-snug text-muted sm:block sm:text-[13px]">{page.description}</p>
      ) : null}
    </div>
  );
}

/**
 * Account menu (sidebar footer row and top-bar avatar). Links to the existing account
 * surfaces: business settings (or staff preferences), billing for owners, and sign out.
 */
function ProfileMenu({
  user,
  isStaff,
  settingsHref,
  settingsLabel,
  trigger,
  placement,
}: {
  user: AdminShellUser | null;
  isStaff: boolean;
  settingsHref: string;
  settingsLabel: string;
  trigger: "avatar" | "row" | "responsive-row";
  placement: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const rollout = useUiRollout();
  const switchInterface = useSwitchInterface();
  const switchTarget = rollout.mode === "new" ? "classic" : "new";
  const name = user?.name?.trim() || "Your account";
  const business = user?.businessName?.trim() || null;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuItem =
    "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-foreground hover:bg-subtle hover:text-heading";

  return (
    <div ref={rootRef} className="relative">
      {trigger === "avatar" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" className="ring-2 ring-accent/15" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={trigger === "responsive-row" ? name : undefined}
          className={cn(
            "flex w-full min-w-0 items-center gap-2.5 rounded-lg py-2 text-left transition-colors hover:bg-subtle",
            trigger === "row" ? "px-2" : "justify-center px-0 lg:justify-start lg:px-2"
          )}
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <span className={cn("min-w-0 flex-1 leading-tight", trigger === "responsive-row" && "hidden lg:block")}>
            <span className="block truncate text-sm font-semibold text-heading">{name}</span>
            {business ? <span className="block truncate text-xs text-muted">{business}</span> : null}
          </span>
          <ChevronsUpDown
            className={cn("h-4 w-4 shrink-0 text-muted", trigger === "responsive-row" && "hidden lg:block")}
            aria-hidden
          />
        </button>
      )}

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[80] w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl",
            placement === "bottom" ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"
          )}
        >
          <div className="border-b border-border px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-semibold text-heading">{name}</p>
            {business ? <p className="truncate text-xs text-muted">{business}</p> : null}
          </div>
          <div className="pt-1.5">
            <Link href={settingsHref} role="menuitem" className={menuItem}>
              <Settings className="h-4 w-4 text-muted" aria-hidden />
              {isStaff ? settingsLabel : "Business settings"}
            </Link>
            {!isStaff ? (
              <Link href="/billing" role="menuitem" className={menuItem}>
                <CreditCard className="h-4 w-4 text-muted" aria-hidden />
                Billing &amp; plan
              </Link>
            ) : null}
            {rollout.canSwitch ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  switchInterface(switchTarget);
                }}
                className={cn(menuItem, "text-accent hover:text-accent")}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {switchTarget === "classic" ? "Switch to Classic Experience" : "Switch to New Experience"}
              </button>
            ) : null}
            <form action="/api/auth/signout" method="POST">
              <button type="submit" role="menuitem" className={menuItem}>
                <LogOut className="h-4 w-4 text-muted" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
