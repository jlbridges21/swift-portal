"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/platform/analytics", label: "Overview" },
  { href: "/platform/analytics/acquisition", label: "Acquisition" },
  { href: "/platform/analytics/blog", label: "Blog" },
  { href: "/platform/analytics/accounts", label: "Accounts" },
  { href: "/platform/analytics/seo", label: "SEO" },
  { href: "/platform/analytics/definitions", label: "Definitions" },
  { href: "/platform/analytics/diagnostics", label: "Diagnostics" },
];

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

function useQuery() {
  const params = useSearchParams();
  return new URLSearchParams(params?.toString() ?? "");
}

export function AnalyticsTabs() {
  const pathname = usePathname();
  const q = useQuery();
  const keep = new URLSearchParams();
  for (const k of ["range", "from", "to"]) {
    const v = q.get(k);
    if (v) keep.set(k, v);
  }
  const suffix = keep.toString() ? `?${keep}` : "";
  return (
    <nav aria-label="Analytics sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const active = t.href === "/platform/analytics" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={`${t.href}${suffix}`}
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

export function RangePicker({ preset, startDay, endDay }: { preset: string; startDay: string; endDay: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const q = useQuery();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(startDay);
  const [to, setTo] = useState(endDay);
  const [showCustom, setShowCustom] = useState(preset === "custom");

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(q);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    start(() => router.push(`${pathname}?${p.toString()}`));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")} aria-busy={pending}>
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => {
              setShowCustom(false);
              go({ range: p.key, from: null, to: null });
            }}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium",
              preset === p.key ? "bg-indigo-600 text-white" : "text-muted hover:text-heading"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={preset === "custom"}
          onClick={() => setShowCustom((v) => !v)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium",
            preset === "custom" ? "bg-indigo-600 text-white" : "text-muted hover:text-heading"
          )}
        >
          Custom
        </button>
      </div>
      {showCustom ? (
        <form
          className="inline-flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            go({ range: "custom", from, to });
          }}
        >
          <label className="sr-only" htmlFor="analytics-from">From</label>
          <input id="analytics-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs" />
          <span className="text-xs text-muted">to</span>
          <label className="sr-only" htmlFor="analytics-to">To</label>
          <input id="analytics-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs" />
          <button type="submit" className="h-8 rounded-md bg-heading px-3 text-xs font-semibold text-white">
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ModelToggle({ model, options }: { model: string; options?: { key: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const q = useQuery();
  const opts = options ?? [
    { key: "first", label: "First touch" },
    { key: "last", label: "Last touch" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Attribution model">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={model === o.key}
          onClick={() => {
            const p = new URLSearchParams(q);
            p.set("model", o.key);
            router.push(`${pathname}?${p.toString()}`);
          }}
          className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", model === o.key ? "bg-heading text-white" : "text-muted hover:text-heading")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
