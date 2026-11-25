"use client";

import { useCallback, useState } from "react";
import { Car, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateKey, formatPeriod } from "@/lib/team-pay/periods";
import type { PersonStatement } from "@/lib/team-pay/server";
import { formatCents, formatHours, formatMilesShort, type PayPeriod } from "@/lib/team-pay/types";
import { StatementView, type MemberActions } from "./statement-view";
import { StatusPill } from "./team-pay-page";

export type MyPayData = {
  ready: boolean;
  enabled: boolean;
  allowTimeRequests: boolean;
  allowCheckIn: boolean;
  todayKey: string;
  timeZone: string;
  period: PayPeriod;
  previous: PayPeriod;
  next: PayPeriod;
  isCurrent: boolean;
  me: PersonStatement | null;
  history: { periodStart: string; periodEnd: string; status: "approved" | "paid"; totalCents: number; paidAt: string | null }[];
};

export function MyPay({ initial }: { initial: MyPayData }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const go = useCallback(async (start: string) => {
    setLoading(true);
    const res = await fetch(`/api/team-pay/me?start=${start}`, { credentials: "include" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as (MyPayData & { error?: string }) | null;
    setLoading(false);
    if (!res?.ok || !json) {
      toast.error(json?.error || "Couldn't load that pay period.");
      return;
    }
    setData(json);
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>, success: string) => {
      const res = await fetch("/api/team-pay/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, start: data.period.start }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as (MyPayData & { error?: string }) | null;
      if (!res?.ok || !json) {
        toast.error(json?.error || "Couldn't save. Try again.");
        return false;
      }
      setData(json);
      toast.success(success);
      return true;
    },
    [data.period.start]
  );

  const member: MemberActions = {
    requestTime: data.allowTimeRequests
      ? (proposalId, onsiteMinutes, note) => post({ action: "request_time", proposalId, onsiteMinutes, note }, "Sent to your manager.")
      : undefined,
    checkIn: data.allowCheckIn ? (proposalId, step) => post({ action: "check_in", proposalId, step }, step === "arrive" ? "Checked in." : "Checked out.") : undefined,
  };

  const statement = data.me?.statement ?? null;
  const t = statement?.totals;
  const locked = statement?.status === "approved" || statement?.status === "paid";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Previous pay period" disabled={loading} onClick={() => void go(data.previous.start)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[13rem] text-center">
          <p className="text-base font-semibold text-heading">{formatPeriod(data.period)}</p>
          <p className="text-xs text-muted">{loading ? "Loading…" : data.isCurrent ? `This pay period · ends ${formatDateKey(data.period.end, { weekday: true })}` : " "}</p>
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Next pay period" disabled={loading || data.isCurrent} onClick={() => void go(data.next.start)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {statement && t ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
                  <Wallet className="h-4 w-4" aria-hidden /> {locked ? "Your pay" : "Earned so far"}
                </p>
                <p className="mt-1 text-4xl font-semibold tabular-nums text-heading">{formatCents(t.amountCents)}</p>
                {t.upcomingShoots > 0 ? (
                  <p className="mt-1 text-sm text-muted">
                    + {formatCents(t.upcomingCents)} from {t.upcomingShoots} upcoming shoot{t.upcomingShoots === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusPill statement={statement.status === "to_review" ? { ...statement, status: "in_progress" } : statement} />
                {statement.paid ? (
                  <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 surface-dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {formatDateKey(statement.paid.at.slice(0, 10))}
                    {statement.paid.method ? ` · ${statement.paid.method}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums text-heading">{t.shoots}</p>
                <p className="text-xs text-muted">shoot{t.shoots === 1 ? "" : "s"}</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums text-heading">
                  <Clock className="h-4 w-4 text-muted" aria-hidden /> {formatHours(t.onsiteMinutes)}
                </p>
                <p className="text-xs text-muted">on site</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums text-heading">
                  <Car className="h-4 w-4 text-muted" aria-hidden /> {formatHours(t.driveMinutes)}
                </p>
                <p className="text-xs text-muted">{formatMilesShort(t.miles)} driving</p>
              </div>
            </div>
            {data.me?.planSummary ? <p className="mt-4 text-xs text-muted">How you&apos;re paid: {data.me.planSummary}</p> : null}
          </section>

          <div className={cn(loading && "opacity-60")}>
            <StatementView statement={statement} timeZone={data.timeZone} todayKey={data.todayKey} member={member} />
          </div>

          <a
            href={`/api/team-pay/stub?start=${data.period.start}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-heading hover:bg-subtle"
          >
            <FileText className="h-4 w-4" aria-hidden /> Pay stub
          </a>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
            <Wallet className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-base font-semibold text-heading">Nothing for this pay period</p>
          <p className="max-w-sm text-sm text-muted">Your shoots and what they pay show up here once you&apos;re on a pay plan.</p>
        </div>
      )}

      {data.history.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-heading">Past pay</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.history.map((h) => (
              <li key={h.periodStart}>
                <button
                  type="button"
                  onClick={() => void go(h.periodStart)}
                  className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle", h.periodStart === data.period.start && "bg-subtle")}
                >
                  <span className="min-w-0 flex-1 text-sm text-heading">{formatPeriod({ start: h.periodStart, end: h.periodEnd })}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      h.status === "paid"
                        ? "bg-emerald-100 text-emerald-800 surface-dark:bg-emerald-500/20 surface-dark:text-emerald-200"
                        : "bg-sky-100 text-sky-800 surface-dark:bg-sky-500/20 surface-dark:text-sky-200"
                    )}
                  >
                    {h.status === "paid" ? "Paid" : "Approved"}
                  </span>
                  <span className="w-24 text-right text-sm font-semibold tabular-nums text-heading">{formatCents(h.totalCents)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
