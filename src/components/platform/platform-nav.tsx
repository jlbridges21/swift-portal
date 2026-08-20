"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/businesses/new", label: "New business" },
  { href: "/platform/plans", label: "Plans" },
  { href: "/platform/audit", label: "Audit log" },
];

export function PlatformNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">ShootPortal</p>
          <p className="text-lg font-semibold text-heading">Platform console</p>
        </div>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => {
            const active =
              link.href === "/platform"
                ? pathname === "/platform"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  active ? "bg-accent-subtle text-heading" : "text-muted hover:bg-subtle hover:text-heading"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
