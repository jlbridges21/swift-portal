import { createServiceClient } from "@/lib/supabase/server";
import type { Rate } from "@/lib/analytics/aggregate";
import type { ReportRange } from "@/lib/analytics/range";

/**
 * Signup-path / trial conversion summary for /platform/analytics/conversions.
 * Source: billing_conversion_events (v107; deduped server-side events), analytics_events
 * (/get-started pageviews) and businesses (trials that ended unpaid). Super-admin only callers.
 */

const MAX_ROWS = 20000;

type EventRow = {
  business_id: string | null;
  event_type: string;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

export type ConversionSummary = {
  ready: boolean;
  truncated: boolean;
  counts: {
    trialSignups: number;
    subscribeSignups: number;
    immediateCheckouts: number;
    immediateActivated: number;
    scheduled: number;
    trialConverted: number;
    trialExpiredUnpaid: number;
    paymentsFailed: number;
    demoViews: number;
    demoCheckouts: number;
    demoActivated: number;
  };
  intervals: { monthly: number; annual: number };
  rates: {
    subscribeActivation: Rate;
    trialToPaid: Rate;
    trialScheduled: Rate;
    demoCheckoutToPaid: Rate;
  };
  modals: { milestone: string; viewed: number; dismissed: number }[];
};

function rate(n: number, d: number, note?: string): Rate {
  return { numerator: n, denominator: d, value: d > 0 ? n / d : null, note };
}

const DEMO_SOURCES = new Set(["demo", "get_started"]);

export async function loadConversionSummary(range: ReportRange): Promise<ConversionSummary> {
  const db = await createServiceClient();
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await db
    .from("billing_conversion_events")
    .select("business_id, event_type, properties, occurred_at")
    .gte("occurred_at", fromIso)
    .lt("occurred_at", toIso)
    .order("occurred_at", { ascending: true })
    .limit(MAX_ROWS);
  const ready = !error;
  const rows = (data ?? []) as EventRow[];

  // Conversions for cohorts that started in range may happen after the range — look ahead.
  const cohortBusinessIds = [
    ...new Set(
      rows
        .filter((r) => r.event_type === "free_trial_started" || r.event_type === "signup_path_selected")
        .map((r) => r.business_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  let laterOutcomes: EventRow[] = [];
  if (ready && cohortBusinessIds.length) {
    const { data: later } = await db
      .from("billing_conversion_events")
      .select("business_id, event_type, properties, occurred_at")
      .in("business_id", cohortBusinessIds.slice(0, 1000))
      .in("event_type", ["immediate_subscription_activated", "trial_converted_to_paid", "trial_subscription_scheduled"])
      .limit(MAX_ROWS);
    laterOutcomes = (later ?? []) as EventRow[];
  }

  const of = (type: string) => rows.filter((r) => r.event_type === type);
  const prop = (r: EventRow, key: string) => (r.properties?.[key] ?? null) as string | null;

  const trialStarts = of("free_trial_started");
  const subscribeSignups = of("signup_path_selected").filter((r) => prop(r, "signup_path") === "subscribe");
  const activated = of("immediate_subscription_activated");
  const scheduled = of("trial_subscription_scheduled");
  const converted = of("trial_converted_to_paid");
  const demoCheckouts = of("demo_checkout_started");

  const outcomeSet = (type: string) =>
    new Set(laterOutcomes.filter((r) => r.event_type === type).map((r) => r.business_id));
  const activatedIds = outcomeSet("immediate_subscription_activated");
  const convertedIds = outcomeSet("trial_converted_to_paid");
  const scheduledIds = outcomeSet("trial_subscription_scheduled");

  const intervals = { monthly: 0, annual: 0 };
  for (const r of [...activated, ...scheduled]) {
    const i = prop(r, "interval");
    if (i === "monthly" || i === "annual") intervals[i] += 1;
  }

  const modalsByMilestone = new Map<string, { viewed: number; dismissed: number }>();
  for (const r of rows) {
    if (r.event_type !== "trial_modal_viewed" && r.event_type !== "trial_modal_dismissed") continue;
    const m = prop(r, "milestone") ?? "unknown";
    const entry = modalsByMilestone.get(m) ?? { viewed: 0, dismissed: 0 };
    if (r.event_type === "trial_modal_viewed") entry.viewed += 1;
    else entry.dismissed += 1;
    modalsByMilestone.set(m, entry);
  }

  const [{ count: demoViews }, { count: expiredUnpaid }] = await Promise.all([
    db
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "pageview")
      .eq("path", "/get-started")
      .gte("occurred_at", fromIso)
      .lt("occurred_at", toIso),
    // Trials that ended in range and are still unpaid (stored status stays trialing until the
    // reporting cron flips it, so both count).
    db
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("created_via", "signup")
      .in("subscription_status", ["trialing", "trial_expired"])
      .gte("trial_ends_at", fromIso)
      .lt("trial_ends_at", new Date(Math.min(range.to.getTime(), Date.now())).toISOString()),
  ]);

  const subscribeIds = subscribeSignups.map((r) => r.business_id);
  const trialIds = trialStarts.map((r) => r.business_id);
  const demoCheckoutIds = new Set(demoCheckouts.map((r) => r.business_id));
  const maturing = "recent cohorts still maturing";

  return {
    ready,
    truncated: rows.length >= MAX_ROWS,
    counts: {
      trialSignups: trialStarts.length,
      subscribeSignups: subscribeSignups.length,
      immediateCheckouts: of("immediate_checkout_started").length,
      immediateActivated: activated.length,
      scheduled: scheduled.length,
      trialConverted: converted.length,
      trialExpiredUnpaid: expiredUnpaid ?? 0,
      paymentsFailed: of("subscription_payment_failed").length,
      demoViews: demoViews ?? 0,
      demoCheckouts: demoCheckoutIds.size,
      demoActivated: activated.filter((r) => DEMO_SOURCES.has(prop(r, "source") ?? "")).length,
    },
    intervals,
    rates: {
      subscribeActivation: rate(subscribeIds.filter((id) => activatedIds.has(id)).length, subscribeIds.length),
      trialToPaid: rate(trialIds.filter((id) => convertedIds.has(id)).length, trialIds.length, maturing),
      trialScheduled: rate(trialIds.filter((id) => scheduledIds.has(id)).length, trialIds.length, maturing),
      demoCheckoutToPaid: rate(
        [...demoCheckoutIds].filter((id) => activatedIds.has(id) || scheduledIds.has(id)).length,
        demoCheckoutIds.size
      ),
    },
    modals: ["day1", "day2", "day5", "day10", "day13"].map((m) => ({
      milestone: m,
      ...(modalsByMilestone.get(m) ?? { viewed: 0, dismissed: 0 }),
    })),
  };
}
