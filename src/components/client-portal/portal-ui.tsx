"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { createThumbRequestQueue } from "@/lib/media-thumb-client";
import { cn } from "@/lib/utils";

/** Rounded content card used across the new client portal (matches the business project page). */
export function PortalCard({
  title,
  icon: Icon,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-32 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-heading">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </div>
      ) : null}
      {children != null ? (
        <div className={cn(title ? "mt-4" : undefined, bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Small pill button used for card header actions ("View Full Gallery →"). */
export function PortalPillButton({
  children,
  onClick,
  href,
  className,
  tone = "outline",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  tone?: "outline" | "accent";
}) {
  const cls = cn(
    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    tone === "accent"
      ? "bg-accent text-accent-foreground hover:bg-accent-hover"
      : "border border-border bg-card text-accent hover:bg-accent-subtle",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Batched, cached signed thumbnail URLs for a handful of assets (sidebar previews, folder covers). */
export function useThumbUrls(ids: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const onUrls = useCallback(
    (next: Record<string, string>) => setUrls((prev) => ({ ...prev, ...next })),
    [],
  );
  const queue = useMemo(() => createThumbRequestQueue(onUrls), [onUrls]);
  useEffect(() => () => queue.reset(), [queue]);
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    for (const id of key.split(",")) queue.request(id);
  }, [key, queue]);
  return urls;
}

/** Thumbnail tile with a quiet placeholder while its signed URL loads. */
export function ThumbTile({
  url,
  className,
  alt = "",
}: {
  url?: string | null;
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-slate-100 surface-dark:bg-subtle",
        className,
      )}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200/60 surface-dark:bg-subtle" />
      )}
    </div>
  );
}

/**
 * Top bar of the new client portal: brand, My Projects, optional project title, messages,
 * notifications and the account menu (settings, new request, sign out).
 */
export function PortalTopBar({
  title,
  onOpenMessages,
  messagesHref = "/dashboard/messages",
  showMyProjects = true,
  userName,
  userAvatar,
  children,
  preview = false,
}: {
  title?: string;
  /** Project page: open the project chat drawer. Otherwise the Messages page link is used. */
  onOpenMessages?: () => void;
  messagesHref?: string;
  showMyProjects?: boolean;
  userName?: string | null;
  userAvatar?: string | null;
  /** Second row (project tabs). */
  children?: ReactNode;
  /** Business preview of the client view: no client account menu or notifications. */
  preview?: boolean;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/dashboard";
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{
    name?: string | null;
    avatar?: string | null;
  }>({ name: userName, avatar: userAvatar });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userName !== undefined || preview) return;
    let cancelled = false;
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile)
          setProfile({
            name: data.profile.full_name,
            avatar: data.profile.avatar_url,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userName, preview]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const messagesButtonClass =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-heading transition-colors hover:bg-accent-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <header className="app-sticky-top app-safe-x sticky top-0 z-40 w-full border-b border-border/80 bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo
            href="/dashboard"
            compact
            showText={false}
            className="flex sm:hidden"
          />
          <Logo href="/dashboard" compact className="hidden sm:flex" />
          {showMyProjects ? (
            <Link
              href="/dashboard"
              aria-current={onHome ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                onHome
                  ? "bg-accent text-accent-foreground"
                  : "bg-accent-subtle text-accent hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <FolderKanban className="h-4 w-4" aria-hidden />
              <span>My Projects</span>
            </Link>
          ) : null}
        </div>
        {title ? (
          <p
            className="hidden min-w-0 flex-1 truncate border-l border-border pl-3 text-base font-semibold text-heading md:block"
            title={title}
          >
            {title}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {onOpenMessages ? (
            <button
              type="button"
              onClick={onOpenMessages}
              className={messagesButtonClass}
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <Link
              href={messagesHref}
              className={messagesButtonClass}
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
            </Link>
          )}
          {preview ? null : (
            <>
              <div className="shrink-0">
                <NotificationBell />
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="inline-flex h-10 items-center gap-1 rounded-lg px-1 transition-colors hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Avatar
                    name={profile.name ?? undefined}
                    src={profile.avatar ?? undefined}
                    size="sm"
                  />
                  <ChevronDown
                    className="hidden h-4 w-4 text-muted sm:block"
                    aria-hidden
                  />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
                  >
                    {profile.name ? (
                      <p className="flex items-center gap-2 truncate border-b border-border px-3 pb-2 pt-1.5 text-sm font-semibold text-heading">
                        <UserRound className="h-4 w-4 text-muted" />{" "}
                        {profile.name}
                      </p>
                    ) : null}
                    <MenuLink
                      href="/dashboard"
                      icon={FolderKanban}
                      onClick={() => setMenuOpen(false)}
                    >
                      My Projects
                    </MenuLink>
                    <MenuLink
                      href="/dashboard/messages"
                      icon={MessageSquare}
                      onClick={() => setMenuOpen(false)}
                    >
                      All Messages
                    </MenuLink>
                    <MenuLink
                      href="/dashboard/request"
                      icon={Plus}
                      onClick={() => setMenuOpen(false)}
                    >
                      Request New Project
                    </MenuLink>
                    <MenuLink
                      href="/dashboard/settings"
                      icon={Settings}
                      onClick={() => setMenuOpen(false)}
                    >
                      Settings
                    </MenuLink>
                    <form
                      action="/api/auth/signout"
                      method="POST"
                      className="border-t border-border"
                    >
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium text-foreground hover:bg-accent-subtle"
                      >
                        <LogOut className="h-4 w-4 text-muted" /> Sign Out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground hover:bg-accent-subtle"
    >
      <Icon className="h-4 w-4 text-muted" /> {children}
    </Link>
  );
}
