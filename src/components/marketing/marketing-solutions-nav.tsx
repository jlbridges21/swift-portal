"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SOLUTION_GROUPS, SOLUTION_PAGES, solutionsInGroup } from "@/lib/solutions";
import { cn } from "@/lib/utils";

/** Solutions menu links, grouped (always in the DOM so crawlers see plain anchors). */
export function SolutionLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <div className={cn("grid", compact ? "gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" : "gap-3 sm:grid-cols-2")}>
      {SOLUTION_GROUPS.map((group) => (
        <div key={group.key}>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{group.label}</p>
          <ul>
            {solutionsInGroup(group.key).map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={onNavigate}
                  className={cn("block rounded-lg transition hover:bg-[#F8FAFC]", compact ? "px-3 py-2" : "px-3 py-2.5")}
                >
                  <span className="block whitespace-normal text-sm font-semibold text-[#0F172A]">{item.navTitle}</span>
                  <span className="mt-0.5 block whitespace-normal text-xs leading-relaxed text-[#475569]">{item.navDescription}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Desktop: hover or focus opens the menu; the label is a button (there is no index page).
 * The panel is positioned against the Primary nav (relative), not the button, so the wide
 * three-column menu stays on screen at the lg breakpoint.
 */
export function MarketingSolutionsDesktop() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const active = SOLUTION_PAGES.some((p) => p.path === pathname);

  function show() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hideSoon() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideSoon();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        // Hover/focus already opened it; a toggle here would close it on the same click or tap.
        // Escape, blur, and mouse-leave close the menu.
        onClick={show}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium text-[#475569] transition hover:text-[#0F172A]",
          (active || open) && "text-[#0F172A]"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
      >
        Solutions
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-70 transition duration-150", open && "rotate-180")} aria-hidden />
      </button>
      <div
        id={menuId}
        inert={!open}
        className={cn(
          "absolute left-1/2 top-full z-50 w-[min(50rem,calc(100vw-2rem))] -translate-x-1/2 pt-3 transition duration-150",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-1 opacity-0"
        )}
      >
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg shadow-slate-900/10">
          <SolutionLinks compact onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
