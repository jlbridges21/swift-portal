import { createServiceClient } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/blog/registry";
import { earliestByBusiness } from "@/lib/analytics/aggregate";
import type {
  AttributionRec,
  BusinessRec,
  EventRec,
  LifecycleRec,
  PaymentRec,
  ReportInput,
  SessionRec,
} from "@/lib/analytics/aggregate";
import type { ReportRange } from "@/lib/analytics/range";

/**
 * Server-only loaders for the super-admin analytics dashboard. Callers MUST have
 * passed requireSuperAdminPage()/requireSuperAdminApi() first. Reads are bounded:
 * marketing rows by date range, cross-tenant rows by narrow column lists.
 */

const PAGE = 1000;
export const MAX_SESSION_ROWS = 100_000;
export const MAX_EVENT_ROWS = 300_000;

type Db = Awaited<ReturnType<typeof createServiceClient>>;

async function paged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  cap: number
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await fetchPage(from, Math.min(from + PAGE, cap) - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export function excludedBusinessIds(): Set<string> {
  return new Set(
    (process.env.ANALYTICS_EXCLUDED_BUSINESS_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function includeTestModePayments(): boolean {
  return process.env.ANALYTICS_INCLUDE_TEST_MODE === "1";
}

async function loadTraffic(db: Db, range: { from: Date; to: Date }) {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const [sessions, events] = await Promise.all([
    paged<SessionRec>(
      (a, b) =>
        db
          .from("analytics_sessions")
          .select("id, visitor_key, consent_mode, started_at, landing_path, landing_article_slug, channel, referrer_host, utm_source, utm_medium, utm_campaign, device_class")
          .gte("started_at", from)
          .lt("started_at", to)
          .order("started_at", { ascending: true })
          .range(a, b),
      MAX_SESSION_ROWS
    ),
    paged<EventRec>(
      (a, b) =>
        db
          .from("analytics_events")
          .select("session_id, visitor_key, event_type, path, article_slug, cta_id, cta_location, occurred_at")
          .gte("occurred_at", from)
          .lt("occurred_at", to)
          .order("occurred_at", { ascending: true })
          .range(a, b),
      MAX_EVENT_ROWS
    ),
  ]);
  return { sessions: sessions.rows, events: events.rows, truncated: sessions.truncated || events.truncated };
}

async function loadAccounts(db: Db, tablesReady: boolean) {
  const none = { rows: [], truncated: false };
  const [businesses, attribution, projects, payments, lifecycle] = await Promise.all([
    paged<BusinessRec>(
      (a, b) =>
        db
          .from("businesses")
          .select("id, name, slug, created_at, created_via, trial_days, trial_ends_at, subscription_status, is_protected, deleted_at")
          .eq("created_via", "signup")
          .order("created_at", { ascending: true })
          .range(a, b),
      50_000
    ),
    !tablesReady
      ? Promise.resolve(none as { rows: AttributionRec[]; truncated: boolean })
      : paged<AttributionRec>(
      (a, b) =>
        db
          .from("business_attribution")
          .select("business_id, status, unknown_reason, visitor_key, ft_channel, ft_referrer_host, ft_utm_source, ft_utm_campaign, ft_landing_path, ft_at, lt_channel, lt_referrer_host, lt_utm_source, lt_utm_campaign, lt_landing_path, lt_at, first_article_slug, last_article_slug, articles_viewed, signup_cta_id, signup_cta_location, signup_cta_path, sessions_before_signup, signup_at")
          .order("signup_at", { ascending: true })
          .range(a, b),
      50_000
    ),
    // Earliest project per business: ascending scan keeps only the first row per business.
    paged<{ business_id: string; created_at: string }>(
      (a, b) => db.from("projects").select("business_id, created_at").order("created_at", { ascending: true }).range(a, b),
      500_000
    ),
    paged<PaymentRec & { stripe_mode: string }>(
      (a, b) => {
        let q = db.from("platform_subscription_payments").select("business_id, amount_paid_cents, paid_at, stripe_mode");
        if (!includeTestModePayments()) q = q.eq("stripe_mode", "live");
        return q.order("paid_at", { ascending: true }).range(a, b);
      },
      200_000
    ),
    !tablesReady
      ? Promise.resolve(none as { rows: (LifecycleRec & { stripe_mode: string | null })[]; truncated: boolean })
      : paged<LifecycleRec & { stripe_mode: string | null }>(
      (a, b) => {
        let q = db.from("business_lifecycle_events").select("business_id, event_type, occurred_at, stripe_mode");
        if (!includeTestModePayments()) q = q.eq("stripe_mode", "live");
        return q.order("occurred_at", { ascending: true }).range(a, b);
      },
      200_000
    ),
  ]);
  const firstProjectAt = earliestByBusiness(projects.rows);
  return {
    businesses: businesses.rows,
    attribution: attribution.rows,
    firstProjectAt,
    payments: payments.rows,
    lifecycle: lifecycle.rows,
  };
}

export type LoadedReport = {
  current: ReportInput;
  previous: ReportInput | null;
  truncated: boolean;
  /** False when the v103 analytics tables are missing (migration not applied). */
  tablesReady: boolean;
  loadError: string | null;
};

function articleList() {
  return getAllArticles().map((a) => ({ slug: a.slug, title: a.title }));
}

export async function loadReport(range: ReportRange, prev: ReportRange | null, now = new Date()): Promise<LoadedReport> {
  const db = await createServiceClient();
  const probe = await db.from("analytics_sessions").select("id", { head: true, count: "exact" }).limit(1);
  const tablesReady = !probe.error;
  const excluded = excludedBusinessIds();
  const articles = articleList();

  const empty = { sessions: [] as SessionRec[], events: [] as EventRec[], truncated: false };
  try {
    const [traffic, prevTraffic, accounts] = await Promise.all([
      tablesReady ? loadTraffic(db, range) : Promise.resolve(empty),
      tablesReady && prev ? loadTraffic(db, prev) : Promise.resolve(empty),
      loadAccounts(db, tablesReady),
    ]);
    const base = { now, articles, excludedBusinessIds: excluded, ...accounts };
    return {
      current: { ...base, range, sessions: traffic.sessions, events: traffic.events },
      previous: prev ? { ...base, range: prev, sessions: prevTraffic.sessions, events: prevTraffic.events } : null,
      truncated: traffic.truncated || prevTraffic.truncated,
      tablesReady,
      loadError: null,
    };
  } catch (err) {
    const base: ReportInput = {
      now,
      range,
      articles,
      excludedBusinessIds: excluded,
      sessions: [],
      events: [],
      businesses: [],
      attribution: [],
      firstProjectAt: new Map(),
      payments: [],
      lifecycle: [],
    };
    return { current: base, previous: null, truncated: false, tablesReady, loadError: err instanceof Error ? err.message : String(err) };
  }
}

/** Single business attribution + lifecycle for /platform/businesses/[id]. */
export async function loadBusinessAttribution(businessId: string) {
  const db = await createServiceClient();
  const [attr, firstProject, firstPaid] = await Promise.all([
    db.from("business_attribution").select("*").eq("business_id", businessId).maybeSingle(),
    db.from("projects").select("created_at").eq("business_id", businessId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    db
      .from("platform_subscription_payments")
      .select("paid_at")
      .eq("business_id", businessId)
      .gt("amount_paid_cents", 0)
      .order("paid_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    tablesReady: !attr.error,
    attribution: (attr.data as (AttributionRec & Record<string, unknown>) | null) ?? null,
    firstProjectAt: (firstProject.data?.created_at as string | undefined) ?? null,
    firstPaidAt: (firstPaid.data?.paid_at as string | undefined) ?? null,
  };
}
