import type { ReactNode } from "react";
import { ArrowRight, Check, CreditCard, FileText, Lock, Unlock, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data-driven diagrams for workflow, pricing, and business-growth articles.
 * HTML/CSS so text stays indexable and reflows on phones. Wrap each in
 * <Figure> with a caption that says whether the numbers are illustrative.
 */

/** ShootPortal's real pipeline stages (src/lib/constants.ts), with fictional jobs. */
const PIPELINE: { stage: string; jobs: { title: string; client: string }[] }[] = [
  { stage: "New request", jobs: [{ title: "412 Riverbend Ln", client: "Maya Ortiz" }] },
  { stage: "Quote sent", jobs: [{ title: "88 Harbor View Dr", client: "Blake Realty" }] },
  { stage: "Approved", jobs: [] },
  { stage: "Scheduled", jobs: [{ title: "15 Cedar Grove Ct", client: "Priya Nair" }, { title: "North Pier site", client: "Atlas Build" }] },
  { stage: "Shoot complete", jobs: [{ title: "7 Summit Way", client: "Lee Group" }] },
  { stage: "Review", jobs: [{ title: "214 Oak St", client: "Avery Chen" }] },
  { stage: "Awaiting payment", jobs: [{ title: "Westfield exterior", client: "Westfield Partners" }] },
  { stage: "Delivered", jobs: [{ title: "31 Lakeview Ter", client: "Sam Okonkwo" }] },
];

export function ProjectBoardDiagram() {
  return (
    <div className="overflow-x-auto rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 [scrollbar-width:thin]" tabIndex={0} role="region" aria-label="Example project pipeline">
      <ol className="mk-plain-list flex min-w-[56rem] gap-3">
        {PIPELINE.map((col, i) => (
          <li key={col.stage} className="w-full min-w-0 flex-1">
            <div className="flex items-center justify-between px-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">{col.stage}</p>
              <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">{col.jobs.length}</span>
            </div>
            <div className="mt-2 min-h-24 space-y-2 rounded-2xl bg-white/60 p-1.5 ring-1 ring-[#E2E8F0]">
              {col.jobs.map((j) => (
                <div
                  key={j.title}
                  className={cn(
                    "rounded-xl border bg-white p-2.5 shadow-sm",
                    i === 6 ? "border-amber-200" : i === 7 ? "border-emerald-200" : "border-[#E2E8F0]"
                  )}
                >
                  <p className="truncate text-xs font-semibold text-[#0F172A]">{j.title}</p>
                  <p className="truncate text-[11px] text-[#64748B]">{j.client}</p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Estimate → deposit → shoot → balance → downloads unlock. */
export function PaymentFlowDiagram({ withDeposit = true }: { withDeposit?: boolean }) {
  const steps: { icon: typeof FileText; title: string; body: string; tone?: "lock" | "unlock" }[] = [
    { icon: FileText, title: "Estimate approved", body: "Scope, price, and terms agreed before you drive anywhere." },
    ...(withDeposit ? [{ icon: CreditCard, title: "Deposit paid", body: "A percentage or flat amount secures the date." }] : []),
    { icon: Lock, title: "Media uploaded", body: "Client can preview and review; downloads stay locked.", tone: "lock" as const },
    { icon: CreditCard, title: "Balance paid", body: "Card payment online, straight to your Stripe account." },
    { icon: Unlock, title: "Downloads unlock", body: "Full-resolution and MLS files become available.", tone: "unlock" as const },
  ];
  return (
    <ol className="mk-plain-list grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className="relative rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                s.tone === "lock" ? "bg-amber-50 text-amber-600" : s.tone === "unlock" ? "bg-emerald-50 text-emerald-600" : "bg-[#EEF2FF] text-[#4F46E5]"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#0F172A]">
              <span className="text-[#94A3B8]">{i + 1}.</span> {s.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#475569]">{s.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** A document-style card for example policies, emails, or scripts. */
export function DocumentCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.6)] sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4F46E5] to-[#A855F7]" aria-hidden />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">{eyebrow}</p>
      <p className="mt-1 text-lg font-semibold text-[#0F172A]">{title}</p>
      <div className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-[#334155] [&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}

export function FunnelDiagram({ stages }: { stages: { label: string; detail: string }[] }) {
  return (
    <ol className="mk-plain-list mx-auto max-w-2xl space-y-2">
      {stages.map((s, i) => {
        const inset = (i / Math.max(stages.length - 1, 1)) * 22;
        return (
          <li key={s.label} style={{ marginLeft: `${inset}%`, marginRight: `${inset}%` }}>
            <div
              className={cn(
                "rounded-2xl px-5 py-3.5 text-center",
                i === stages.length - 1 ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" : "border border-[#E2E8F0] bg-white"
              )}
            >
              <p className={cn("text-sm font-semibold", i === stages.length - 1 ? "text-white" : "text-[#0F172A]")}>{s.label}</p>
              <p className={cn("mt-0.5 text-xs leading-relaxed", i === stages.length - 1 ? "text-indigo-100" : "text-[#64748B]")}>{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const SEGMENT_COLORS = ["#4F46E5", "#7C3AED", "#0EA5E9", "#14B8A6", "#F59E0B", "#F43F5E", "#64748B"];

/** Stacked bar + legend showing where a job's price goes. Amounts are whatever the article passes in. */
export function CostBreakdown({ items, totalLabel }: { items: { label: string; amount: number; note?: string }[]; totalLabel?: string }) {
  const total = items.reduce((n, i) => n + i.amount, 0);
  return (
    <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[#0F172A]">{totalLabel ?? "Example job total"}</p>
        <p className="text-2xl font-bold tracking-tight text-[#0F172A]">${total.toLocaleString("en-US")}</p>
      </div>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full" aria-hidden>
        {items.map((it, i) => (
          <span key={it.label} style={{ width: `${(it.amount / total) * 100}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
        ))}
      </div>
      <ul className="mk-plain-list mt-5 grid gap-2.5 sm:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-start gap-2.5 text-sm">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} aria-hidden />
            <span className="min-w-0 flex-1 text-[#334155]">
              {it.label}
              {it.note ? <span className="block text-xs text-[#64748B]">{it.note}</span> : null}
            </span>
            <span className="font-semibold tabular-nums text-[#0F172A]">${it.amount.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Example package menu. Prices are the article's illustrative numbers. */
export function ServiceMenu({
  packages,
  addons,
}: {
  packages: { name: string; price: string; blurb: string; includes: string[]; highlight?: boolean }[];
  addons?: { name: string; price: string }[];
}) {
  return (
    <div className="rounded-3xl border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC] p-4 sm:p-6">
      <div className={cn("grid gap-3", packages.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {packages.map((p) => (
          <div
            key={p.name}
            className={cn(
              "flex flex-col rounded-2xl border bg-white p-5",
              p.highlight ? "border-[#A5B4FC] shadow-[0_20px_50px_-36px_rgba(79,70,229,0.7)] ring-1 ring-[#C7D2FE]" : "border-[#E2E8F0]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[#0F172A]">{p.name}</p>
              {p.highlight ? <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4F46E5]">Recommended</span> : null}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">{p.price}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{p.blurb}</p>
            <ul className="mk-plain-list mt-4 space-y-1.5 text-sm text-[#334155]">
              {p.includes.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {addons?.length ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Add-ons</p>
          <ul className="mk-plain-list mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {addons.map((a) => (
              <li key={a.name} className="flex justify-between gap-3 border-b border-dotted border-[#E2E8F0] pb-1.5 text-[#334155]">
                <span>{a.name}</span>
                <span className="font-semibold tabular-nums text-[#0F172A]">{a.price}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Estimate document mock: line items, travel fee, deposit. */
export function SampleEstimate({
  title,
  client,
  lines,
  depositPercent,
}: {
  title: string;
  client: string;
  lines: { label: string; detail?: string; amount: number }[];
  depositPercent?: number;
}) {
  const total = lines.reduce((n, l) => n + l.amount, 0);
  const deposit = depositPercent ? Math.round((total * depositPercent) / 100) : null;
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-50px_rgba(15,23,42,0.7)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">Estimate</p>
          <p className="mt-1 font-semibold text-[#0F172A]">{title}</p>
          <p className="text-xs text-[#64748B]">Prepared for {client}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Awaiting approval</span>
      </div>
      <ul className="mk-plain-list divide-y divide-[#F1F5F9] px-6">
        {lines.map((l) => (
          <li key={l.label} className="flex items-start justify-between gap-4 py-3 text-sm">
            <span className="text-[#0F172A]">
              {l.label}
              {l.detail ? <span className="block text-xs text-[#64748B]">{l.detail}</span> : null}
            </span>
            <span className="font-semibold tabular-nums text-[#0F172A]">${l.amount.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5 border-t border-[#E2E8F0] px-6 py-4 text-sm">
        <div className="flex justify-between font-semibold text-[#0F172A]">
          <span>Total</span>
          <span className="tabular-nums">${total.toLocaleString("en-US")}</span>
        </div>
        {deposit != null ? (
          <div className="flex justify-between text-[#475569]">
            <span>Deposit due on approval ({depositPercent}%)</span>
            <span className="tabular-nums">${deposit.toLocaleString("en-US")}</span>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 px-6 pb-6">
        <span className="flex-1 rounded-lg bg-[#4F46E5] py-2.5 text-center text-sm font-semibold text-white">Approve estimate</span>
        <span className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-center text-sm font-medium text-[#0F172A]">Request changes</span>
      </div>
    </div>
  );
}

export function ChecklistCard({ groups }: { groups: { title: string; items: ReactNode[] }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g, gi) => (
        <div key={g.title} className="mk-reveal rounded-3xl border border-[#E2E8F0] bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-bold text-[#4F46E5]">{gi + 1}</span>
            {g.title}
          </p>
          <ul className="mk-plain-list mt-3 space-y-2 text-sm text-[#334155]">
            {g.items.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#C7D2FE] bg-[#EEF2FF]" aria-hidden>
                  <Check className="h-3 w-3 text-[#4F46E5]" />
                </span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RoadmapDiagram({ phases }: { phases: { title: string; when: string; items: string[] }[] }) {
  return (
    <ol className="mk-plain-list relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {phases.map((p, i) => (
        <li key={p.title} className="mk-reveal relative rounded-3xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white">{i + 1}</span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{p.title}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">{p.when}</p>
            </div>
          </div>
          <ul className="mk-plain-list mt-3 space-y-1.5 text-sm text-[#475569]">
            {p.items.map((x) => (
              <li key={x} className="flex gap-2">
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A5B4FC]" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal bars comparing file sizes against sending limits. */
export function FileSizeChart({
  files,
  limits,
  unit = "GB",
}: {
  files: { label: string; size: number; note?: string }[];
  limits: { label: string; size: number }[];
  unit?: string;
}) {
  const max = Math.max(...files.map((f) => f.size), ...limits.map((l) => l.size));
  const fmt = (n: number) => (n < 1 ? `${Math.round(n * 1000)} MB` : `${n.toLocaleString("en-US")} ${unit}`);
  return (
    <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Approximate file sizes</p>
      <ul className="mk-plain-list mt-3 space-y-3">
        {files.map((f) => (
          <li key={f.label}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-[#0F172A]">
                {f.label}
                {f.note ? <span className="ml-1.5 text-xs text-[#64748B]">{f.note}</span> : null}
              </span>
              <span className="font-semibold tabular-nums text-[#0F172A]">{fmt(f.size)}</span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-[#F1F5F9]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" style={{ width: `${Math.max((f.size / max) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Common sending limits</p>
      <ul className="mk-plain-list mt-3 grid gap-2 sm:grid-cols-2">
        {limits.map((l) => (
          <li key={l.label} className="flex justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm">
            <span className="text-[#334155]">{l.label}</span>
            <span className="font-semibold tabular-nums text-[#0F172A]">{fmt(l.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Side-by-side "manual" vs "organized" lists. */
export function BeforeAfter({
  beforeTitle = "Manual",
  afterTitle = "Organized",
  before,
  after,
}: {
  beforeTitle?: string;
  afterTitle?: string;
  before: ReactNode[];
  after: ReactNode[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{beforeTitle}</p>
        <ul className="mk-plain-list mt-3 space-y-2.5 text-sm text-[#475569]">
          {before.map((b, i) => (
            <li key={i} className="flex gap-2.5">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl border border-[#C7D2FE] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(79,70,229,0.7)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">{afterTitle}</p>
        <ul className="mk-plain-list mt-3 space-y-2.5 text-sm text-[#1E293B]">
          {after.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
