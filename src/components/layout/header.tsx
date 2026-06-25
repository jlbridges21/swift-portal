"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

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
  const homeHref =
    variant === "public" ? "/" : userRole === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white/90 backdrop-blur-lg safe-area-top safe-area-x">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <Logo href={homeHref} size="md" />

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
              <Link
                href="/admin/projects"
                className="md:hidden rounded-md px-3 py-1.5 text-sm text-muted"
              >
                Projects
              </Link>
              <NotificationBell />
              <form action="/api/auth/signout" method="POST">
                <Button variant="ghost" size="sm" type="submit" className="min-h-11 px-3">Sign Out</Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2.5 min-h-11 inline-flex items-center text-sm text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
              >
                My Projects
              </Link>
              <Link
                href="/dashboard/request"
                className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-slate-100 hover:text-foreground sm:inline-block"
              >
                New Request
              </Link>
              <NotificationBell />
              <ClientProfileNav userName={userName} userAvatar={userAvatar} />
              <form action="/api/auth/signout" method="POST">
                <Button variant="ghost" size="sm" type="submit" className="min-h-11 px-3">Sign Out</Button>
              </form>
            </>
          )}
        </nav>
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
