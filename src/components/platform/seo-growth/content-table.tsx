"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABELS } from "@/lib/seo-growth/inventory";
import type { ChecklistItem, ContentAuditRow } from "@/lib/seo-growth/content-audit";

const KIND_FILTERS: { key: ChecklistItem["kind"] | "all" | "clean"; label: string }[] = [
  { key: "all", label: "All pages" },
  { key: "linking", label: "Linking" },
  { key: "refresh", label: "Refresh" },
  { key: "accuracy", label: "Accuracy" },
  { key: "links", label: "Broken links" },
  { key: "overlap", label: "Overlap" },
  { key: "clean", label: "No items" },
];

export function ContentTable({ rows, origin }: { rows: ContentAuditRow[]; origin: string }) {
  const [filter, setFilter] = useState<(typeof KIND_FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(
    () =>
      rows
        .filter((r) => (filter === "all" ? true : filter === "clean" ? r.items.length === 0 : r.items.some((i) => i.kind === filter)))
        .sort((a, b) => b.items.filter((i) => i.severity === "warning").length - a.items.filter((i) => i.severity === "warning").length || b.items.length - a.items.length),
    [rows, filter]
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter checklist">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", filter === f.key ? "bg-heading text-white" : "border border-border bg-card text-muted hover:text-heading")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.map((r) => {
          const isOpen = open === r.path;
          const warn = r.items.filter((i) => i.severity === "warning").length;
          return (
            <li key={r.path}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.path)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-heading">{r.title}</span>
                  <span className="block truncate font-mono text-xs text-muted">
                    {r.path} · {KIND_LABELS[r.kind]} · {r.cluster}
                    {r.wordCount ? ` · ${r.wordCount.toLocaleString("en-US")} words` : ""}
                  </span>
                </span>
                {r.items.length ? (
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", warn ? "bg-amber-50 text-amber-800" : "bg-subtle text-muted")}>
                    {r.items.length} item{r.items.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-emerald-700">No items</span>
                )}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", isOpen && "rotate-180")} aria-hidden />
              </button>
              {isOpen ? (
                <div className="space-y-2 px-4 pb-4">
                  {r.items.length ? (
                    r.items.map((i) => (
                      <div key={i.id} className="rounded-lg border border-border p-3 text-sm">
                        <p className="font-medium text-heading">
                          {i.title}
                          {i.dueAt ? <span className="ml-2 text-xs font-normal text-muted">due {i.dueAt}</span> : null}
                        </p>
                        <p className="mt-0.5 text-muted">{i.why}</p>
                        {i.detail ? <p className="mt-1 break-words text-xs text-muted">{i.detail}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">The automated checks found nothing to change. That doesn&apos;t replace a human read for accuracy and usefulness.</p>
                  )}
                  <p className="text-xs text-muted">
                    {r.publishedAt ? `Published ${r.publishedAt}` : ""}
                    {r.factsVerifiedAt ? ` · facts verified ${r.factsVerifiedAt}` : ""}{" "}
                    <a href={`${origin}${r.path}`} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                      Open page
                    </a>
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
