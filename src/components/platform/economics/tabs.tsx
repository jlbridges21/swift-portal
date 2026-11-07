"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/platform/economics", label: "Overview" },
  { href: "/platform/economics/storage", label: "Storage & Bandwidth" },
  { href: "/platform/economics/businesses", label: "Business Economics" },
  { href: "/platform/economics/simulator", label: "Pricing Simulator" },
  { href: "/platform/economics/costs", label: "Costs & Assumptions" },
];

export function EconomicsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform economics sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const active = t.href === "/platform/economics" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-heading text-white" : "text-muted hover:bg-subtle hover:text-heading"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
