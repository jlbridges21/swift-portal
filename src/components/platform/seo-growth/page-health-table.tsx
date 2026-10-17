"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type PageKind } from "@/lib/seo-growth/inventory";
import type { HealthStatus, PageHealth } from "@/lib/seo-growth/health";
import { GoogleBadge, HealthBadge, HEALTH_LABELS } from "@/components/platform/seo-growth/badges";

const select = "h-8 rounded-md border border-border bg-card px-2 text-xs text-heading";
const STATUS_ORDER: Record<HealthStatus, number> = { critical: 0, attention: 1, unknown: 2, healthy: 3 };

function day(iso: string | null) {
  return iso ? iso.slice(0, 10) : "—";
}

export function PageHealthTable({ rows }: { rows: PageHealth[] }) {
  const [status, setStatus] = useState<HealthStatus | "all">("all");
  const [kind, setKind] = useState<PageKind | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const kinds = [...new Set(rows.map((r) => r.page.kind))];
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => (status === "all" || r.status === status) && (kind === "all" || r.page.kind === kind) && (!term || r.path.includes(term) || r.page.title.toLowerCase().includes(term)))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.page.commercialValue - a.page.commercialValue || a.path.localeCompare(b.path));
  }, [rows, status, kind, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="ph-q">Search pages</label>
          <input id="ph-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className="h-8 w-48 rounded-md border border-border bg-card pl-8 pr-2 text-xs" />
        </div>
        <label className="sr-only" htmlFor="ph-status">Status</label>
        <select id="ph-status" className={select} value={status} onChange={(e) => setStatus(e.target.value as HealthStatus | "all")}>
          <option value="all">All statuses</option>
          {(Object.keys(HEALTH_LABELS) as HealthStatus[]).map((s) => (
            <option key={s} value={s}>
              {HEALTH_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="ph-kind">Page type</label>
        <select id="ph-kind" className={select} value={kind} onChange={(e) => setKind(e.target.value as PageKind | "all")}>
          <option value="all">All page types</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">{list.length} pages</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-subtle/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Page</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Google</th>
              <th className="px-3 py-2 font-medium">Last crawl</th>
              <th className="px-3 py-2 text-right font-medium" title="Distinct monitored pages linking here from page content (not nav/footer)">
                In-content links
              </th>
              <th className="px-3 py-2 text-right font-medium">Issues</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const isOpen = open === r.path;
              return (
                <Fragment key={r.path}>
                  <tr className="cursor-pointer border-t border-border hover:bg-subtle/40" onClick={() => setOpen(isOpen ? null : r.path)}>
                    <td className="px-3 py-2">
                      <span className="block font-mono text-xs text-heading">{r.path}</span>
                      <span className="text-xs text-muted">{KIND_LABELS[r.page.kind]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <HealthBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2">
                      <GoogleBadge state={r.google.state} label={r.google.label} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">{day(r.google.lastCrawlTime)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.site.contextualInbound}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.issues.length || "—"}</td>
                    <td className="px-2 py-2">
                      <button type="button" aria-expanded={isOpen} aria-label={`Details for ${r.path}`} className="rounded p-1 text-muted hover:text-heading">
                        <ChevronDown className={cn("h-4 w-4 transition", isOpen && "rotate-180")} aria-hidden />
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-border bg-subtle/30">
                      <td colSpan={7} className="px-4 py-4">
                        <Details r={r} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Details({ r }: { r: PageHealth }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {r.issues.length ? (
          <ul className="space-y-2">
            {r.issues.map((i) => (
              <li key={i.id} className="rounded-lg border border-border bg-card p-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-heading">
                  <span
                    className={cn(
                      "rounded px-1.5 text-[11px] font-semibold uppercase",
                      i.severity === "critical" ? "bg-rose-50 text-rose-700" : i.severity === "warning" ? "bg-amber-50 text-amber-800" : "bg-subtle text-muted"
                    )}
                  >
                    {i.severity === "info" ? "minor" : i.severity}
                  </span>
                  {i.title}
                  <span className="text-xs font-normal text-muted">{i.source === "google" ? "· reported by Google" : "· site check"}</span>
                </p>
                {i.fix ? <p className="mt-1 text-sm text-muted">{i.fix}</p> : null}
                <details className="mt-1 text-xs text-muted">
                  <summary className="cursor-pointer">Technical detail</summary>
                  <p className="mt-1 break-words font-mono">{i.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No issues found by the site check{r.google.state === "indexed" ? " and Google reports the page as indexed." : "."}</p>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted">Google coverage</dt>
        <dd className="text-heading">{r.google.coverageState ?? "—"}</dd>
        <dt className="text-muted">Google canonical</dt>
        <dd className="break-all text-heading">{r.google.googleCanonical ?? "—"}</dd>
        <dt className="text-muted">Declared canonical</dt>
        <dd className="break-all text-heading">{r.site.canonical ?? "—"}</dd>
        <dt className="text-muted">HTTP status</dt>
        <dd className="text-heading">{r.site.httpStatus ?? "—"}</dd>
        <dt className="text-muted">Indexable</dt>
        <dd className="text-heading">{r.site.indexable === null ? "—" : r.site.indexable ? "Yes" : "No (noindex)"}</dd>
        <dt className="text-muted">robots.txt</dt>
        <dd className="text-heading">{r.site.robotsAllowed === null ? "—" : r.site.robotsAllowed ? "Allowed" : "Blocked"}</dd>
        <dt className="text-muted">In sitemap</dt>
        <dd className="text-heading">{r.site.inSitemap ? "Yes" : "No"}</dd>
        <dt className="text-muted">Words</dt>
        <dd className="tabular-nums text-heading">{r.site.wordCount?.toLocaleString("en-US") ?? "—"}</dd>
        <dt className="text-muted">Linked from</dt>
        <dd className="text-heading">{r.site.contextualInboundFrom.length ? r.site.contextualInboundFrom.join(", ") : "Navigation only"}</dd>
        <dt className="text-muted">Title</dt>
        <dd className="text-heading">{r.site.title ?? "—"}</dd>
        <dd className="col-span-2 mt-2 flex flex-wrap gap-2">
          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-medium text-heading hover:bg-subtle">
            Open page <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {r.google.inspectionLink ? (
            <a href={r.google.inspectionLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-medium text-heading hover:bg-subtle">
              Inspect in Search Console <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </dd>
      </dl>
    </div>
  );
}
