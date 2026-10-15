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

/** Presence only (never the value) for the diagnostics page. */
export function serviceRoleConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
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

type Paged<T> = { rows: T[]; truncated: boolean };

/** Run one loader; on failure record a labelled warning and return an empty set. */
async function safeLoad<T>(label: string, warnings: string[], run: () => Promise<Paged<T>>): Promise<Paged<T>> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[analytics] ${label} failed`, message);
    warnings.push(`${label}: ${message}`);
    return { rows: [], truncated: false };
  }
}

async function loadAccounts(db: Db, tablesReady: boolean, warnings: string[]) {
  const [businesses, attribution, projects, payments, lifecycle] = await Promise.all([
    // Trials start at signup (createBusinessForPlatform); the plan's trial length lives on
    // plans.trial_days, so a self-serve business is "on a trial" when trial_ends_at is set.
    safeLoad<BusinessRec>("Businesses", warnings, () =>
      paged<BusinessRec>(
        (a, b) =>
          db
            .from("businesses")
            .select("id, name, slug, created_at, created_via, trial_ends_at, subscription_status, is_protected, deleted_at")
            .eq("created_via", "signup")
            .order("created_at", { ascending: true })
            .range(a, b),
        50_000
      )
    ),
    tablesReady
      ? safeLoad<AttributionRec>("Attribution", warnings, () =>
          paged<AttributionRec>(
            (a, b) =>
              db
                .from("business_attribution")
                .select("business_id, status, unknown_reason, visitor_key, ft_channel, ft_referrer_host, ft_utm_source, ft_utm_campaign, ft_landing_path, ft_at, lt_channel, lt_referrer_host, lt_utm_source, lt_utm_campaign, lt_landing_path, lt_at, first_article_slug, last_article_slug, articles_viewed, signup_cta_id, signup_cta_location, signup_cta_path, sessions_before_signup, signup_at")
                .order("signup_at", { ascending: true })
                .range(a, b),
            50_000
          )
        )
      : Promise.resolve({ rows: [] as AttributionRec[], truncated: false }),
    safeLoad<{ business_id: string; created_at: string }>("Projects", warnings, () =>
      paged<{ business_id: string; created_at: string }>(
        (a, b) => db.from("projects").select("business_id, created_at").order("created_at", { ascending: true }).range(a, b),
        500_000
      )
    ),
    safeLoad<PaymentRec & { stripe_mode: string }>("Subscription payments", warnings, () =>
      paged<PaymentRec & { stripe_mode: string }>(
        (a, b) => {
          let q = db.from("platform_subscription_payments").select("business_id, amount_paid_cents, paid_at, stripe_mode");
          if (!includeTestModePayments()) q = q.eq("stripe_mode", "live");
          return q.order("paid_at", { ascending: true }).range(a, b);
        },
        200_000
      )
    ),
    tablesReady
      ? safeLoad<LifecycleRec & { stripe_mode: string | null }>("Billing history", warnings, () =>
          paged<LifecycleRec & { stripe_mode: string | null }>(
            (a, b) => {
              let q = db.from("business_lifecycle_events").select("business_id, event_type, occurred_at, stripe_mode");
              if (!includeTestModePayments()) q = q.eq("stripe_mode", "live");
              return q.order("occurred_at", { ascending: true }).range(a, b);
            },
            200_000
          )
        )
      : Promise.resolve({ rows: [] as (LifecycleRec & { stripe_mode: string | null })[], truncated: false }),
  ]);
  return {
    businesses: businesses.rows,
    attribution: attribution.rows,
    firstProjectAt: earliestByBusiness(projects.rows),
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
  const warnings: string[] = [];
  const emptyTraffic = { sessions: [] as SessionRec[], events: [] as EventRec[], truncated: false };
  const traffic = async (label: string, r: { from: Date; to: Date }) => {
    if (!tablesReady) return emptyTraffic;
    try {
      return await loadTraffic(db, r);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[analytics] ${label} failed`, message);
      warnings.push(`${label}: ${message}`);
      return emptyTraffic;
    }
  };
  const [current, previous, accounts] = await Promise.all([
    traffic("Website traffic", range),
    prev ? traffic("Previous-period traffic", prev) : Promise.resolve(emptyTraffic),
    loadAccounts(db, tablesReady, warnings),
  ]);
  const base = { now, articles: articleList(), excludedBusinessIds: excludedBusinessIds(), ...accounts };
  return {
    current: { ...base, range, sessions: current.sessions, events: current.events },
    previous: prev ? { ...base, range: prev, sessions: previous.sessions, events: previous.events } : null,
    truncated: current.truncated || previous.truncated,
    tablesReady,
    loadError: warnings.length ? warnings.join(" · ") : null,
  };
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

export type AnalyticsDiagnostics = {
  tables: { name: string; ok: boolean; rows: number | null; error: string | null }[];
  latestEventAt: string | null;
  latestSessionAt: string | null;
  last24h: { pageviews: number; ctaClicks: number; signupStarts: number; sessions: number; persistentSessions: number; cookielessSessions: number } | null;
  saltToday: boolean | null;
  latestAttributionAt: string | null;
  error: string | null;
};

/** Aggregate-only health checks for /platform/analytics/diagnostics (no visitor rows returned). */
export async function loadAnalyticsDiagnostics(now = new Date()): Promise<AnalyticsDiagnostics> {
  const db = await createServiceClient();
  const names = ["analytics_sessions", "analytics_events", "analytics_daily_salts", "business_attribution", "business_lifecycle_events"];
  const tables = await Promise.all(
    names.map(async (name) => {
      const r = await db.from(name).select("*", { head: true, count: "exact" });
      return { name, ok: !r.error, rows: r.error ? null : r.count ?? 0, error: r.error?.message ?? null };
    })
  );
  if (!tables[0]!.ok || !tables[1]!.ok) {
    return { tables, latestEventAt: null, latestSessionAt: null, last24h: null, saltToday: null, latestAttributionAt: null, error: null };
  }
  try {
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const r = await q;
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    };
    const ev = (type: string) => db.from("analytics_events").select("id", { head: true, count: "exact" }).eq("event_type", type).gte("occurred_at", since);
    const ss = (mode?: string) => {
      let q = db.from("analytics_sessions").select("id", { head: true, count: "exact" }).gte("started_at", since);
      if (mode) q = q.eq("consent_mode", mode);
      return q;
    };
    const [latestEvent, latestSession, latestAttr, salt, pageviews, ctaClicks, signupStarts, sessions, persistentSessions, cookielessSessions] =
      await Promise.all([
        db.from("analytics_events").select("occurred_at").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("analytics_sessions").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("business_attribution").select("recorded_at").order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("analytics_daily_salts").select("day").eq("day", now.toISOString().slice(0, 10)).maybeSingle(),
        count(ev("pageview")),
        count(ev("cta_click")),
        count(ev("signup_start")),
        count(ss()),
        count(ss("persistent")),
        count(ss("cookieless")),
      ]);
    return {
      tables,
      latestEventAt: (latestEvent.data?.occurred_at as string | undefined) ?? null,
      latestSessionAt: (latestSession.data?.started_at as string | undefined) ?? null,
      latestAttributionAt: (latestAttr.data?.recorded_at as string | undefined) ?? null,
      saltToday: !!salt.data,
      last24h: { pageviews, ctaClicks, signupStarts, sessions, persistentSessions, cookielessSessions },
      error: null,
    };
  } catch (err) {
    return { tables, latestEventAt: null, latestSessionAt: null, last24h: null, saltToday: null, latestAttributionAt: null, error: err instanceof Error ? err.message : String(err) };
  }
}
