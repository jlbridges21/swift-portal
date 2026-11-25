"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Download,
  FileText,
  Hourglass,
  Loader2,
  RotateCcw,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/admin/booking/booking-ui";
import { cn } from "@/lib/utils";
import { EXPORT_FORMATS } from "@/lib/team-pay/export";
import { formatDateKey, formatPeriod } from "@/lib/team-pay/periods";
import type { PeriodOverview, PersonStatement } from "@/lib/team-pay/server";
import {
  formatCents,
  formatHours,
  formatMilesShort,
  PAID_METHODS,
  type AdjustmentKind,
  type PayStatement,
  type StatementStatus,
} from "@/lib/team-pay/types";
import { StatementView, type StatementActions } from "./statement-view";

const STATUS: Record<StatementStatus, { label: string; className: string; icon: typeof Clock }> = {
  in_progress: { label: "In progress", className: "bg-subtle text-muted", icon: Hourglass },
  to_review: { label: "To review", className: "bg-amber-100 text-amber-800 surface-dark:bg-amber-500/20 surface-dark:text-amber-200", icon: AlertTriangle },
  ready: { label: "Ready to approve", className: "bg-accent-subtle text-accent", icon: Check },
  approved: { label: "Approved · not paid", className: "bg-sky-100 text-sky-800 surface-dark:bg-sky-500/20 surface-dark:text-sky-200", icon: CheckCircle2 },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800 surface-dark:bg-emerald-500/20 surface-dark:text-emerald-200", icon: CircleDollarSign },
};

export function StatusPill({ statement }: { statement: PayStatement }) {
  const s = STATUS[statement.status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", s.className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {statement.status === "to_review" ? `${statement.reviewCount} to review` : s.label}
    </span>
  );
}

/** Review → Approve → Pay, with the current step lit: the page's whole job in one glance. */
function Pipeline({ status }: { status: StatementStatus }) {
  const index = status === "paid" ? 3 : status === "approved" ? 2 : status === "ready" ? 1 : 0;
  const steps = ["Review", "Approve", "Pay"];
  return (
    <ol className="flex items-center gap-1.5 text-xs font-medium" aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
              i < index ? "bg-emerald-500 text-white" : i === index ? "bg-accent text-accent-foreground" : "bg-subtle text-muted"
            )}
          >
            {i < index ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === index ? "text-heading" : "text-muted")}>{label}</span>
          {i < steps.length - 1 ? <span className={cn("h-px w-5", i < index ? "bg-emerald-500" : "bg-border")} aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-4 w-4" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-heading">{value}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function ExportMenu({ start, userId }: { start: string; userId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Download className="h-4 w-4" /> Export <ChevronDown className="h-4 w-4" />
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {EXPORT_FORMATS.map((f) => (
            <a
              key={f.id}
              role="menuitem"
              href={`/api/team-pay/export?start=${start}&format=${f.id}${userId ? `&user=${userId}` : ""}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 hover:bg-subtle"
            >
              <span className="block text-sm font-medium text-heading">{f.label}</span>
              <span className="block text-xs text-muted">{f.hint}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PayForm({ onPay, onCancel }: { onPay: (method: string, reference: string) => Promise<boolean>; onCancel: () => void }) {
  const [method, setMethod] = useState<string>(PAID_METHODS[0]);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-medium text-heading">How did you pay?</p>
      <div role="radiogroup" aria-label="Paid by" className="flex flex-wrap gap-2">
        {PAID_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm font-medium transition-colors",
              method === m ? "border-accent bg-accent-subtle/60 text-accent ring-1 ring-accent" : "border-border text-heading hover:bg-subtle"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={120}
          placeholder="Check number or reference (optional)"
          aria-label="Reference"
          className="h-11 min-w-[12rem] flex-1 rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
        />
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="accent"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onPay(method, reference);
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Mark paid
        </Button>
      </div>
    </div>
  );
}

function PersonCard({
  entry,
  overview,
  open,
  onToggle,
  act,
}: {
  entry: PersonStatement;
  overview: PeriodOverview;
  open: boolean;
  onToggle: () => void;
  act: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
}) {
  const { person, statement } = entry;
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const t = statement.totals;
  const run = async (key: string, body: Record<string, unknown>, success?: string) => {
    setBusy(key);
    const ok = await act({ userId: person.userId, ...body }, success);
    setBusy(null);
    return ok;
  };
  const actions: StatementActions = {
    editShoot: (proposalId, patch) => act({ action: "edit_shoot", proposalId, ...patch }, "Saved."),
    decideRequest: (requestId, approve) => act({ action: "decide_request", requestId, approve }, approve ? "Time approved." : "Kept the booked time."),
    addAdjustment: (input: { kind: AdjustmentKind; label: string; amountCents: number; dateKey: string }) =>
      act({ action: "add_adjustment", userId: person.userId, ...input }, "Added."),
    deleteAdjustment: (adjustmentId) => act({ action: "delete_adjustment", adjustmentId }, "Removed."),
  };
  const open_ = statement.status === "in_progress" || statement.status === "to_review" || statement.status === "ready";
  const cta =
    statement.status === "to_review" ? "Review" : statement.status === "ready" ? "Approve" : statement.status === "approved" ? "Mark paid" : null;

  return (
    <li className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors", open ? "border-accent" : "border-border")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left hover:bg-subtle/60">
        <PersonAvatar name={person.name} url={person.avatarUrl} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-base font-semibold text-heading">{person.name}</span>
            <StatusPill statement={statement} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {t.shoots} shoot{t.shoots === 1 ? "" : "s"} · {formatHours(t.onsiteMinutes)} on site
            {t.driveMinutes > 0 || t.miles > 0 ? ` · ${formatHours(t.driveMinutes)} / ${formatMilesShort(t.miles)} driving` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-xl font-semibold tabular-nums text-heading">{formatCents(t.amountCents)}</span>
          {cta ? (
            <span className={cn("text-xs font-semibold", statement.status === "to_review" ? "text-amber-700 surface-dark:text-amber-300" : "text-accent")}>{cta}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pipeline status={statement.status} />
            <p className="text-xs text-muted">
              {entry.planSummary}
              {entry.planSummary ? " · " : ""}
              {person.workerType === "employee" ? "Employee" : "Contractor"}
            </p>
          </div>

          <StatementView statement={statement} timeZone={overview.timeZone} todayKey={overview.todayKey} actions={actions} />

          {/* The one next step for this person, always in the same place. */}
          {paying ? (
            <PayForm
              onCancel={() => setPaying(false)}
              onPay={async (method, reference) => {
                const ok = await run("pay", { action: "mark_paid", method, reference }, `${person.name} marked paid.`);
                if (ok) setPaying(false);
                return ok;
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/team-pay/stub?start=${statement.period.start}&user=${person.userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-heading hover:bg-subtle"
                >
                  <FileText className="h-4 w-4" aria-hidden /> Pay stub
                </a>
                {statement.status === "approved" ? (
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("reopen", { action: "reopen" }, "Reopened.")}>
                    <RotateCcw className="h-4 w-4" /> Reopen
                  </Button>
                ) : null}
                {statement.status === "paid" ? (
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("undo", { action: "undo_paid" }, "Marked not paid.")}>
                    <RotateCcw className="h-4 w-4" /> Not paid yet
                  </Button>
                ) : null}
              </div>

              {open_ ? (
                statement.reviewCount > 0 ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 surface-dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" aria-hidden /> Settle the {statement.reviewCount} highlighted shoot{statement.reviewCount === 1 ? "" : "s"} to approve
                  </p>
                ) : t.upcomingShoots > 0 ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <Hourglass className="h-4 w-4" aria-hidden /> {t.upcomingShoots} shoot{t.upcomingShoots === 1 ? "" : "s"} still to come · approve after {formatDateKey(statement.period.end)}
                  </p>
                ) : (
                  <Button type="button" variant="accent" disabled={busy !== null} onClick={() => void run("approve", { action: "approve" }, `${person.name}'s pay approved.`)}>
                    {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve {formatCents(t.amountCents)}
                  </Button>
                )
              ) : statement.status === "approved" ? (
                <Button type="button" variant="accent" onClick={() => setPaying(true)}>
                  <CircleDollarSign className="h-4 w-4" /> Mark paid
                </Button>
              ) : statement.paid ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 surface-dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Paid {formatDateKey(statement.paid.at.slice(0, 10))}
                  {statement.paid.method ? ` · ${statement.paid.method}` : ""}
                  {statement.paid.reference ? ` · ${statement.paid.reference}` : ""}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function TeamPayPage({ initial, canConfigure }: { initial: PeriodOverview; canConfigure: boolean }) {
  const [overview, setOverview] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => {
    const first = initial.people.find((p) => p.statement.status === "to_review") ?? (initial.people.length === 1 ? initial.people[0] : null);
    return first?.person.userId ?? null;
  });

  const go = useCallback(async (start: string) => {
    setLoading(true);
    const res = await fetch(`/api/team-pay?start=${start}`, { credentials: "include" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as (PeriodOverview & { error?: string }) | null;
    setLoading(false);
    if (!res?.ok || !json) {
      toast.error(json?.error || "Couldn't load that pay period.");
      return;
    }
    setOverview(json);
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>, success?: string) => {
      const res = await fetch("/api/team-pay", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, start: overview.period.start }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as (PeriodOverview & { error?: string }) | null;
      if (!res?.ok || !json) {
        toast.error(json?.error || "Couldn't save. Try again.");
        return false;
      }
      setOverview(json);
      if (success) toast.success(success);
      return true;
    },
    [overview.period.start]
  );

  const { people, totals, period } = overview;
  const count = (status: StatementStatus) => people.filter((p) => p.statement.status === status).length;
  const unpaidCents = people.filter((p) => p.statement.status !== "paid").reduce((sum, p) => sum + p.statement.totals.amountCents, 0);
  const ended = overview.todayKey > period.end;
  const upcoming = period.start > overview.todayKey;

  return (
    <div className="space-y-5">
      {/* Pay period */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Previous pay period" disabled={loading} onClick={() => void go(overview.previous.start)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[13rem] text-center">
            <p className="text-base font-semibold text-heading">{formatPeriod(period)}</p>
            <p className="text-xs text-muted">
              {loading ? "Loading…" : overview.isCurrent ? `This pay period · ends ${formatDateKey(period.end, { weekday: true })}` : ended ? "Ended" : upcoming ? "Coming up" : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Next pay period" disabled={loading} onClick={() => void go(overview.next.start)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!overview.isCurrent ? (
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void go(overview.todayKey)}>
              Today
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {people.length ? <ExportMenu start={period.start} /> : null}
          {canConfigure ? (
            <Link
              href="/admin/settings#settings-team-pay"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-heading hover:bg-subtle"
            >
              <SettingsIcon className="h-4 w-4" aria-hidden /> Pay plans
            </Link>
          ) : null}
        </div>
      </div>

      {people.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={CircleDollarSign}
              label={unpaidCents === 0 && totals.amountCents > 0 ? "Paid" : "To pay"}
              value={formatCents(unpaidCents === 0 ? totals.amountCents : unpaidCents)}
              sub={totals.upcomingShoots ? `+ ${formatCents(totals.upcomingCents)} still to come` : undefined}
            />
            <Tile icon={Users} label="Shoots" value={String(totals.shoots)} sub={`${people.length} ${people.length === 1 ? "person" : "people"}`} />
            <Tile icon={Clock} label="On site" value={formatHours(totals.onsiteMinutes)} />
            <Tile icon={Car} label="Driving" value={formatHours(totals.driveMinutes)} sub={formatMilesShort(totals.miles)} />
          </div>

          {count("to_review") > 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {count("to_review")} {count("to_review") === 1 ? "person has" : "people have"} shoots waiting on you.
            </p>
          ) : null}

          <ul className={cn("space-y-3", loading && "opacity-60")}>
            {people.map((entry) => (
              <PersonCard
                key={entry.person.userId}
                entry={entry}
                overview={overview}
                open={openId === entry.person.userId}
                onToggle={() => setOpenId((id) => (id === entry.person.userId ? null : entry.person.userId))}
                act={act}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
            <Users className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-base font-semibold text-heading">Nobody is on a pay plan yet</p>
          <p className="max-w-sm text-sm text-muted">Put a team member on a pay plan and their shoots show up here with what you owe.</p>
          {canConfigure ? (
            <Link href="/admin/settings#settings-team-pay" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              Set up pay plans <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
