"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PARTNER_NAV_SECTIONS, type PartnerSectionId } from "@/lib/partner-nav";

export function PartnerTabNav({ accentColor = "#4F46E5" }: { accentColor?: string }) {
  const pathname = usePathname();

  return (
    <>
      <div className="md:hidden">
        <label htmlFor="partner-section-select" className="sr-only">
          Partner section
        </label>
        <select
          id="partner-section-select"
          value={pathname}
          onChange={(e) => {
            window.location.href = e.target.value;
          }}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-primary"
        >
          {PARTNER_NAV_SECTIONS.map((section) => (
            <option key={section.id} value={section.href}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <nav
        aria-label="Partner program sections"
        className="hidden md:flex md:flex-col md:gap-0.5"
      >
        {PARTNER_NAV_SECTIONS.map((section) => {
          const selected =
            pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <Link
              key={section.id}
              href={section.href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selected ? "font-semibold" : "text-muted hover:bg-subtle hover:text-foreground"
              )}
              style={
                selected
                  ? {
                      backgroundColor: "var(--color-accent-subtle)",
                      color: "var(--color-accent)",
                      boxShadow: `inset 3px 0 0 ${accentColor}`,
                    }
                  : undefined
              }
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export type { PartnerSectionId };
