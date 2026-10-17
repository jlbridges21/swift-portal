"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Performance (Search Console report) vs. Growth engine, shown on both SEO pages. */
export function SeoSubNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["range", "from", "to"]) {
    const v = params?.get(k);
    if (v) keep.set(k, v);
  }
  const suffix = keep.toString() ? `?${keep}` : "";
  const items = [
    { href: "/platform/analytics/seo", label: "Search performance", active: pathname === "/platform/analytics/seo" },
    { href: "/platform/analytics/seo/growth", label: "Growth engine", active: pathname.startsWith("/platform/analytics/seo/growth") },
  ];
  return (
    <div className="mb-5 inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="SEO views">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href === "/platform/analytics/seo" ? `${i.href}${suffix}` : i.href}
          aria-current={i.active ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", i.active ? "bg-indigo-600 text-white" : "text-muted hover:text-heading")}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export const GROWTH_VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "opportunities", label: "Opportunities" },
  { key: "indexing", label: "Indexing" },
  { key: "content", label: "Content" },
  { key: "gaps", label: "Content gaps" },
  { key: "conversions", label: "Conversions" },
  { key: "roadmap", label: "Roadmap" },
] as const;

export type GrowthView = (typeof GROWTH_VIEWS)[number]["key"];

export function GrowthTabs({ view, counts }: { view: GrowthView; counts: Partial<Record<GrowthView, number>> }) {
  return (
    <nav aria-label="SEO growth sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {GROWTH_VIEWS.map((v) => {
        const active = v.key === view;
        return (
          <Link
            key={v.key}
            href={v.key === "overview" ? "/platform/analytics/seo/growth" : `/platform/analytics/seo/growth?view=${v.key}`}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active ? "border-indigo-600 text-heading" : "border-transparent text-muted hover:text-heading"
            )}
          >
            {v.label}
            {counts[v.key] ? (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-indigo-50 text-indigo-700" : "bg-subtle text-muted")}>{counts[v.key]}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const working = busy || pending;
  return (
    <button
      type="button"
      disabled={working}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/platform/seo-growth/refresh", { method: "POST", credentials: "include" });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(json.error || "Refresh failed");
          toast.message("Re-checking the site and Google. This takes up to a minute.");
          start(() => router.refresh());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Refresh failed");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-heading shadow-sm hover:bg-subtle disabled:opacity-60"
      aria-busy={working}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", working && "animate-spin")} aria-hidden />
      {working ? "Checking…" : "Refresh checks"}
    </button>
  );
}
