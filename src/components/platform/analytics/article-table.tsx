"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { ArticleRow } from "@/lib/analytics/aggregate";
import { cn } from "@/lib/utils";

type Model = "first" | "last" | "assisted";
type SortKey =
  | "title"
  | "visitors"
  | "sessions"
  | "pageviews"
  | "ctaClicks"
  | "registrations"
  | "trials"
  | "activated"
  | "paid"
  | "signupRate"
  | "paidRate"
  | "revenueCents";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ArticleTable({ rows, rangeQuery }: { rows: ArticleRow[]; rangeQuery: string }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState<Model>("first");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "pageviews", dir: "desc" });
  const [onlyActive, setOnlyActive] = useState(false);

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .map((r) => {
        const c = r[model];
        return {
          ...r,
          c,
          signupRate: model !== "assisted" && r.consentedVisitors ? c.registrations / r.consentedVisitors : null,
          paidRate: c.registrations ? c.paid / c.registrations : null,
        };
      })
      .filter((r) => (!term || r.title.toLowerCase().includes(term) || r.slug.includes(term)) && (!onlyActive || r.pageviews > 0 || r.c.registrations > 0))
      .sort((a, b) => {
        const val = (r: typeof a): number | string => {
          switch (sort.key) {
            case "title":
              return r.title;
            case "registrations":
            case "trials":
            case "activated":
            case "paid":
            case "revenueCents":
              return r.c[sort.key];
            case "signupRate":
              return r.signupRate ?? -1;
            case "paidRate":
              return r.paidRate ?? -1;
            default:
              return r[sort.key];
          }
        };
        const va = val(a);
        const vb = val(b);
        const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [rows, q, model, sort, onlyActive]);

  const header = (key: SortKey, label: string, title?: string) => (
    <th scope="col" className={cn("py-2 pr-3 font-medium", key === "title" ? "text-left" : "text-right")} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        title={title}
        onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-heading"
      >
        {label}
        {sort.key === key ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search articles</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Hide articles with no activity
          </label>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Attribution model">
            {(
              [
                ["first", "First touch"],
                ["last", "Last touch"],
                ["assisted", "Assisted"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={model === k}
                onClick={() => setModel(k)}
                className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", model === k ? "bg-heading text-white" : "text-muted hover:text-heading")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {model === "assisted" ? (
        <p className="mb-3 text-xs text-muted">Assisted counts overlap: one registration can be assisted by several articles. Do not add them up.</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[68rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              {header("title", "Article")}
              {header("visitors", "Visitors")}
              {header("sessions", "Sessions")}
              {header("pageviews", "Views")}
              {header("ctaClicks", "CTA clicks")}
              {header("registrations", "Reg.")}
              {header("trials", "Trials")}
              {header("activated", "Activated")}
              {header("paid", "Paying")}
              {header("signupRate", "Signup rate", "Credited registrations ÷ consented article visitors (the only visitors attribution can link). Not shown for Assisted.")}
              {header("paidRate", "Paid rate", "Paying ÷ credited registrations")}
              {header("revenueCents", "Revenue")}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.slug} className="border-b border-border/70 last:border-0 hover:bg-subtle/60">
                <td className="max-w-[22rem] py-2.5 pr-3">
                  <Link href={`/platform/analytics/blog/${r.slug}${rangeQuery}`} className="font-medium text-heading hover:text-indigo-600 hover:underline">
                    {r.title}
                  </Link>
                  <span className="block truncate text-xs text-muted">/blog/{r.slug}</span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.visitors)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.sessions)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.pageviews)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.ctaClicks)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-heading">{fmt(r.c.registrations)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.c.trials)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.c.activated)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(r.c.paid)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{pct(r.signupRate)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{pct(r.paidRate)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(r.c.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length ? <p className="py-8 text-center text-sm text-muted">No articles match.</p> : null}
      </div>
    </div>
  );
}
