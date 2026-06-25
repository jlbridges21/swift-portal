"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Menu, Plus, Settings, X } from "lucide-react";

interface HeaderProps {
  variant?: "public" | "dashboard";
  userRole?: "admin" | "client";
  userName?: string | null;
  userAvatar?: string | null;
}

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/new-requests", label: "New Requests" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/clients", label: "Clients" },
];

function ClientProfileNav({
  userName: propName,
  userAvatar: propAvatar,
}: {
  userName?: string | null;
  userAvatar?: string | null;
}) {
  const [name, setName] = useState(propName);
  const [avatar, setAvatar] = useState(propAvatar);

  useEffect(() => {
    if (propName !== undefined) setName(propName);
    if (propAvatar !== undefined) setAvatar(propAvatar);
  }, [propName, propAvatar]);

  useEffect(() => {
    if (propName !== undefined) return;
    fetch("/api/profile", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.profile) {
          setName(data.profile.full_name);
          setAvatar(data.profile.avatar_url);
        }
      });
  }, [propName]);

  return (
    <Link
      href="/dashboard/settings"
      className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 transition-colors"
      title="Settings"
    >
      <Avatar name={name} src={avatar} size="sm" />
      <Settings className="h-4 w-4 text-muted hidden sm:block" />
    </Link>
  );
}

export function Header({ variant = "public", userRole, userName, userAvatar }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const homeHref =
    variant === "public" ? "/" : userRole === "admin" ? "/admin" : "/dashboard";

  const clientMobileLinks = [
    { href: "/dashboard", label: "My Projects" },
    { href: "/dashboard/request", label: "Request New Project" },
    { href: "/dashboard/settings", label: "Settings" },
  ];

  const adminMobileLinks = adminLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white/90 backdrop-blur-lg safe-area-top safe-area-x">
      <div className="relative mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-2 px-5 py-2 sm:min-h-16 sm:px-6 lg:px-8">
        <Logo href={homeHref} compact className="max-w-[52vw] sm:max-w-none sm:hidden" />
        <Logo href={homeHref} size="md" className="hidden sm:flex" />

        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          {variant === "public" ? (
            <>
              <Link href="/request">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Request a Shoot
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="accent" size="sm" className="min-h-11 px-4">Client Login</Button>
              </Link>
            </>
          ) : userRole === "admin" ? (
            <>
              <div className="hidden md:contents">
                {adminLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <NotificationBell />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden min-h-11 min-w-11"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <form action="/api/auth/signout" method="POST" className="hidden md:block">
                <Button variant="ghost" size="sm" type="submit" className="min-h-11 px-3">Sign Out</Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/request"
                className="hidden sm:inline-flex"
              >
                <Button variant="accent" size="sm" className="min-h-11">
                  <Plus className="h-4 w-4" /> New Request
                </Button>
              </Link>
              <NotificationBell />
              <div className="hidden sm:block">
                <ClientProfileNav userName={userName} userAvatar={userAvatar} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:hidden min-h-11 min-w-11"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <form action="/api/auth/signout" method="POST" className="hidden sm:block">
                <Button variant="ghost" size="sm" type="submit" className="min-h-11 px-3">Sign Out</Button>
              </form>
            </>
          )}
        </nav>

        {variant === "dashboard" && menuOpen && (
          <div className="absolute left-0 right-0 top-full border-b border-border bg-white shadow-lg sm:hidden">
            <div className="space-y-1 px-5 py-3 safe-area-x">
              {(userRole === "admin" ? adminMobileLinks : clientMobileLinks).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}
              <form action="/api/auth/signout" method="POST" className="pt-2 border-t border-border">
                <Button variant="ghost" type="submit" className="w-full min-h-11 justify-start px-3">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
