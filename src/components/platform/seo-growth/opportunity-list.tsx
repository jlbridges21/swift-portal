"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ExternalLink, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, EVIDENCE_LABELS, type EvidenceType, type OppCategory, type Opportunity } from "@/lib/seo-growth/opportunities";
import type { ReviewState } from "@/lib/seo-growth/store";
import { EvidenceBadge, LevelChip, PriorityBadge } from "@/components/platform/seo-growth/badges";

type Row = Opportunity & { review: ReviewState | null };
type StatusFilter = "open" | "reviewed" | "dismissed" | "all";

const effortRank = { low: 0, medium: 1, high: 2 } as const;
const confRank = { high: 0, medium: 1, low: 2 } as const;
const select = "h-8 rounded-md border border-border bg-card px-2 text-xs text-heading";

function statusOf(r: Row): "open" | "reviewed" | "dismissed" {
  return r.review?.status ?? "open";
}

export function OpportunityList({ rows, origin, compact = false }: { rows: Row[]; origin: string; compact?: boolean }) {
  const [category, setCategory] = useState<OppCategory | "all">("all");
  const [evidence, setEvidence] = useState<EvidenceType | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [sort, setSort] = useState<"priority" | "effort" | "confidence">("priority");

  const list = useMemo(
    () =>
      rows
        .filter((r) => (category === "all" || r.category === category) && (evidence === "all" || r.evidenceType === evidence) && (status === "all" || statusOf(r) === status))
        .sort((a, b) =>
          sort === "effort"
            ? effortRank[a.effort] - effortRank[b.effort] || b.score - a.score
            : sort === "confidence"
              ? confRank[a.confidence] - confRank[b.confidence] || b.score - a.score
              : b.score - a.score
        ),
    [rows, category, evidence, status, sort]
  );

  const categories = [...new Set(rows.map((r) => r.category))];
  const counts = { open: 0, reviewed: 0, dismissed: 0 };
  for (const r of rows) counts[statusOf(r)]++;

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Status">
            {(["open", "reviewed", "dismissed", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium capitalize", status === s ? "bg-heading text-white" : "text-muted hover:text-heading")}
              >
                {s}
                {s !== "all" ? <span className="ml-1 tabular-nums opacity-70">{counts[s]}</span> : null}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="opp-cat">Category</label>
          <select id="opp-cat" className={select} value={category} onChange={(e) => setCategory(e.target.value as OppCategory | "all")}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="opp-ev">Evidence</label>
          <select id="opp-ev" className={select} value={evidence} onChange={(e) => setEvidence(e.target.value as EvidenceType | "all")}>
            <option value="all">All evidence</option>
            {(Object.keys(EVIDENCE_LABELS) as EvidenceType[]).map((k) => (
              <option key={k} value={k}>
                {EVIDENCE_LABELS[k]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="opp-sort">Sort</label>
          <select id="opp-sort" className={select} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="priority">Sort: priority</option>
            <option value="effort">Sort: least effort</option>
            <option value="confidence">Sort: most confident</option>
          </select>
          <span className="ml-auto text-xs text-muted">{list.length} shown</span>
        </div>
      ) : null}
      {list.length ? (
        <ol className="space-y-3">
          {list.map((r, i) => (
            <OpportunityCard key={r.id} row={r} rank={i + 1} origin={origin} defaultOpen={false} />
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {status === "open" ? "Nothing open matches these filters." : "Nothing here yet."}
        </p>
      )}
    </div>
  );
}

function OpportunityCard({ row: r, rank, origin, defaultOpen }: { row: Row; rank: number; origin: string; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const st = statusOf(r);

  const act = async (action: "reviewed" | "dismissed" | "reopened") => {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/seo-growth/review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action, note }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      toast.success(action === "reviewed" ? "Marked reviewed" : action === "dismissed" ? "Dismissed" : "Reopened");
      setNote("");
      start(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const panelId = `opp-${rank}-details`;
  return (
    <li className={cn("rounded-2xl border bg-card shadow-sm transition", st === "open" ? "border-border" : "border-border/60 opacity-75")}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={panelId} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold tabular-nums text-muted">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={r.priority} />
            <EvidenceBadge type={r.evidenceType} />
            <span className="text-xs text-muted">{CATEGORY_LABELS[r.category]}</span>
            {r.dueAt ? <span className="text-xs text-muted">· due {r.dueAt}</span> : null}
            {st !== "open" ? <span className="text-xs font-medium capitalize text-muted">· {st}</span> : null}
          </span>
          <span className="mt-1.5 block text-sm font-semibold text-heading">{r.title}</span>
          <span className="mt-0.5 block text-sm text-muted">{r.why}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="space-y-4 border-t border-border px-4 pb-4 pt-3 text-sm sm:pl-13">
          <div className="flex flex-wrap gap-1.5">
            <LevelChip label="Effort" level={r.effort} />
            <LevelChip label="Confidence" level={r.confidence} />
            <span className="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs text-muted" title="Internal heuristic: (impact × 2 + commercial value) × confidence ÷ effort">
              Score {r.score} (heuristic)
            </span>
          </div>
          <Section title="Recommended action">
            <p className="text-heading">{r.action}</p>
            {r.guidance.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {r.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section title="Evidence">
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {r.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Section>
          <div className="grid gap-3 sm:grid-cols-2">
            <Section title="Expected benefit">
              <p className="text-muted">{r.benefit}</p>
            </Section>
            <Section title="Business relevance">
              <p className="text-muted">{r.businessRelevance}</p>
            </Section>
          </div>
          {r.pages.length ? (
            <Section title={`Affected page${r.pages.length === 1 ? "" : "s"}`}>
              <ul className="flex flex-wrap gap-1.5">
                {r.pages.map((p) => (
                  <li key={p}>
                    <a
                      href={`${origin}${p === "/" ? "/" : p}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-xs text-heading hover:bg-subtle"
                    >
                      {p}
                      <ExternalLink className="h-3 w-3 text-muted" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {r.review ? (
            <p className="text-xs text-muted">
              {r.review.status === "open" ? "Reopened" : r.review.status === "reviewed" ? "Reviewed" : "Dismissed"} {new Date(r.review.at).toLocaleDateString()}
              {r.review.by ? ` by ${r.review.by}` : ""}
              {r.review.note ? ` · "${r.review.note}"` : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <label className="sr-only" htmlFor={`${panelId}-note`}>Note</label>
            <input
              id={`${panelId}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Optional note"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-xs"
            />
            {st === "open" ? (
              <>
                <ActionButton onClick={() => act("reviewed")} disabled={busy || pending} icon={<Check className="h-3.5 w-3.5" aria-hidden />}>
                  Mark reviewed
                </ActionButton>
                <ActionButton onClick={() => act("dismissed")} disabled={busy || pending} icon={<EyeOff className="h-3.5 w-3.5" aria-hidden />}>
                  Dismiss
                </ActionButton>
              </>
            ) : (
              <ActionButton onClick={() => act("reopened")} disabled={busy || pending} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}>
                Reopen
              </ActionButton>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function ActionButton({ children, icon, onClick, disabled }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-heading hover:bg-subtle disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}
