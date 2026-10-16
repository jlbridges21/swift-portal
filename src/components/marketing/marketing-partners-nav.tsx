"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SolutionLinks } from "@/components/marketing/marketing-solutions-nav";
import { ResourceLinks } from "@/components/marketing/marketing-resources-nav";

export const PARTNER_NAV_LINKS = [
  {
    href: "/partners",
    title: "Program Partners",
    description: "Earn recurring commissions by referring ShootPortal.",
  },
  {
    href: "/strategic-partners",
    title: "Strategic Partners",
    description: "Brands and businesses working alongside ShootPortal.",
  },
] as const;

function PartnerLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <>
      {PARTNER_NAV_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "block rounded-lg transition hover:bg-[#F8FAFC]",
            compact ? "px-3 py-2.5" : "px-3 py-3"
          )}
        >
          <span className="block text-sm font-semibold text-[#0F172A]">{item.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-[#475569]">{item.description}</span>
        </Link>
      ))}
    </>
  );
}

/** Desktop: the Partners label still navigates to /partners. Hover or focus opens the menu. */
export function MarketingPartnersDesktop() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const active = pathname === "/partners" || pathname === "/strategic-partners";

  function show() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hideSoon() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideSoon();
      }}
    >
      <Link
        href="/partners"
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium text-[#475569] transition hover:text-[#0F172A]",
          active && "text-[#0F172A]"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
      >
        Partners
        <ChevronDown
          className={cn("h-3.5 w-3.5 opacity-70 transition duration-150", open && "rotate-180")}
          aria-hidden
        />
      </Link>
      <div
        id={menuId}
        inert={!open}
        className={cn(
          "absolute left-1/2 top-full z-50 w-96 -translate-x-1/2 pt-3 transition duration-150",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0 pointer-events-none"
        )}
      >
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg shadow-slate-900/10">
          <PartnerLinks compact onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}

/** Mobile strip items that open a panel instead of navigating. */
const MENU_FOR: Record<string, "partners" | "solutions" | "resources"> = { "/partners": "partners", "#solutions": "solutions", "#resources": "resources" };

/** Mobile strip. Tapping Solutions or Partners expands its destinations below the row. */
export function MarketingMobileNav({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const panelId = useId();
  const solutionsPanelId = useId();
  const [menu, setMenu] = useState<"partners" | "solutions" | "resources" | null>(null);
  const resourcesPanelId = useId();
  const active = pathname === "/partners" || pathname === "/strategic-partners";

  useEffect(() => {
    setMenu(null);
  }, [pathname]);

  const toggle = (which: "partners" | "solutions" | "resources") => setMenu((value) => (value === which ? null : which));

  return (
    <nav className="border-t border-[#E2E8F0] px-4 py-2 lg:hidden" aria-label="Mobile">
      <div className="flex gap-4 overflow-x-auto">
        {items.map((item) => {
          const which = MENU_FOR[item.href];
          if (which) {
            const isOpen = menu === which;
            return (
              <button
                key={item.href}
                type="button"
                className={cn("inline-flex shrink-0 items-center gap-1 py-1 text-sm font-medium text-[#475569]", (isOpen || (which === "partners" && active)) && "text-[#0F172A]")}
                aria-expanded={isOpen}
                aria-controls={which === "partners" ? panelId : which === "solutions" ? solutionsPanelId : resourcesPanelId}
                onClick={() => toggle(which)}
              >
                {item.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition duration-150", isOpen && "rotate-180")} aria-hidden />
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 py-1 text-sm font-medium text-[#475569]"
            >
              {item.label}
            </Link>
          );
        })}
        <Link href="/login" className="shrink-0 py-1 text-sm font-medium text-[#475569] sm:hidden">
          Log in
        </Link>
      </div>
      {/* The header is sticky, so a tall panel must scroll inside the viewport or its last links are unreachable. */}
      <div
        id={solutionsPanelId}
        hidden={menu !== "solutions"}
        className="mt-2 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-sm"
      >
        <SolutionLinks onNavigate={() => setMenu(null)} />
      </div>
      <div id={resourcesPanelId} hidden={menu !== "resources"} className="mt-2 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-sm">
        <ResourceLinks onNavigate={() => setMenu(null)} />
      </div>
      <div id={panelId} hidden={menu !== "partners"} className="mt-2 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-sm">
        <PartnerLinks onNavigate={() => setMenu(null)} />
      </div>
    </nav>
  );
}
