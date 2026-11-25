/**
 * Team pay — one team member's own view (My pay). Server only.
 * Never includes anyone else's pay, and never what a client paid.
 */
import { buildPeriodOverview, listStatementHistory, type PersonStatement } from "./server";
import type { PayPeriod } from "./types";

export type MyPayPayload = {
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

/** "40% of $275" → "40% of the shoot": team members don't see client prices. */
export function hideClientPrices(entry: PersonStatement): PersonStatement {
  return {
    ...entry,
    statement: {
      ...entry.statement,
      lines: entry.statement.lines.map((line) => ({
        ...line,
        parts: line.parts.map((part) => ({ ...part, label: part.label.replace(/^([\d.]+% of) -?\$[\d,.]+$/, "$1 the shoot") })),
      })),
    },
  };
}

export async function buildMyPay(businessId: string, userId: string, start: string | null): Promise<MyPayPayload> {
  const [overview, history] = await Promise.all([
    buildPeriodOverview(businessId, { start, onlyUserId: userId }),
    listStatementHistory(businessId, userId),
  ]);
  // Off, or not on a pay plan: nothing to show.
  const visible = overview.ready && overview.settings.enabled;
  const mine = visible ? overview.people.find((p) => p.person.userId === userId) ?? null : null;
  return {
    ready: overview.ready,
    enabled: visible,
    allowTimeRequests: overview.settings.allowTimeRequests,
    allowCheckIn: overview.settings.allowCheckIn,
    todayKey: overview.todayKey,
    timeZone: overview.timeZone,
    period: overview.period,
    previous: overview.previous,
    next: overview.next,
    isCurrent: overview.isCurrent,
    me: mine ? hideClientPrices(mine) : null,
    history: visible ? history : [],
  };
}
