"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Calculator, ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/** Resources menu: blog, free tools, and the template library. Plain anchors for crawlers. */
export const RESOURCE_LINKS = [
  { href: "/tools", title: "Free tools", description: "Pricing calculators and a quote builder.", icon: Calculator },
  { href: "/resources", title: "Template library", description: "Price sheets, quotes, invoices, and checklists.", icon: FileText },
  { href: "/blog", title: "Blog", description: "Guides on pricing, delivery, and running the business.", icon: BookOpen },
] as const;

export function ResourceLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul>
      {RESOURCE_LINKS.map((l) => {
        const Icon = l.icon;
        return (
          <li key={l.href}>
            <Link href={l.href} onClick={onNavigate} className="flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F8FAFC]">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
              <span>
                <span className="block whitespace-normal text-sm font-semibold text-[#0F172A]">{l.title}</span>
                <span className="mt-0.5 block whitespace-normal text-xs leading-relaxed text-[#475569]">{l.description}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop: hover or focus opens; click only opens (a toggle would close it on the same click). */
export function MarketingResourcesDesktop() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const active = ["/blog", "/tools", "/resources"].some((p) => pathname === p || pathname.startsWith(`${p}/`));

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
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hideSoon();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={show}
        className={cn("inline-flex items-center gap-1 text-sm font-medium text-[#475569] transition-colors hover:text-[#0F172A]", (active || open) && "text-[#0F172A]")}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
      >
        Resources
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-70 transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      <div
        id={menuId}
        inert={!open}
        className={cn(
          "absolute left-1/2 top-full z-50 w-[20rem] -translate-x-1/2 pt-3 transition-[opacity,transform,visibility] duration-150",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-1 opacity-0"
        )}
      >
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg shadow-slate-900/10">
          <ResourceLinks onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
