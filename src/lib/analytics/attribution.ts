import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { Channel } from "@/lib/analytics/channels";

/**
 * Signup attribution. A snapshot is written ONCE per business at verified
 * registration (inside createBusinessForPlatform, after the business insert).
 * Only consented visitors (first-party `sp_vid` cookie) can be linked; everyone
 * else is stored as status "unknown" so they never masquerade as Direct.
 */

export const VISITOR_COOKIE = "sp_vid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AttributionSession = {
  id: string;
  started_at: string;
  channel: Channel;
  referrer_host: string | null;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

export type AttributionEvent = {
  session_id: string;
  event_type: "pageview" | "cta_click" | "signup_start";
  path: string;
  article_slug: string | null;
  cta_id: string | null;
  cta_location: string | null;
  occurred_at: string;
};

type Touch = {
  channel: Channel;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string;
  at: string;
};

export type AttributionSnapshot = {
  status: "attributed" | "unknown";
  unknown_reason: string | null;
  first: Touch | null;
  last: Touch | null;
  first_article_slug: string | null;
  last_article_slug: string | null;
  articles_viewed: string[];
  signup_cta_id: string | null;
  signup_cta_location: string | null;
  signup_cta_path: string | null;
  sessions_before_signup: number;
};

function toTouch(s: AttributionSession): Touch {
  return {
    channel: s.channel,
    referrer_host: s.referrer_host,
    utm_source: s.utm_source,
    utm_medium: s.utm_medium,
    utm_campaign: s.utm_campaign,
    utm_content: s.utm_content,
    utm_term: s.utm_term,
    landing_path: s.landing_path,
    at: s.started_at,
  };
}

/**
 * Pure: summarize a visitor's sessions/events up to `signupAt`.
 * First touch = earliest session. Last touch = latest non-direct session before
 * signup (Direct only when every session was direct).
 */
export function buildAttributionSnapshot(
  sessionsIn: AttributionSession[],
  eventsIn: AttributionEvent[],
  signupAt: Date
): AttributionSnapshot {
  const cutoff = signupAt.getTime();
  const sessions = sessionsIn
    .filter((s) => Date.parse(s.started_at) <= cutoff)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const sessionIds = new Set(sessions.map((s) => s.id));
  const events = eventsIn
    .filter((e) => sessionIds.has(e.session_id) && Date.parse(e.occurred_at) <= cutoff)
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));

  if (!sessions.length) {
    return {
      status: "unknown",
      unknown_reason: "visitor_has_no_tracked_visits",
      first: null,
      last: null,
      first_article_slug: null,
      last_article_slug: null,
      articles_viewed: [],
      signup_cta_id: null,
      signup_cta_location: null,
      signup_cta_path: null,
      sessions_before_signup: 0,
    };
  }

  const nonDirect = sessions.filter((s) => s.channel !== "direct" && s.channel !== "unknown");
  const lastTouch = nonDirect.length ? nonDirect[nonDirect.length - 1]! : sessions[sessions.length - 1]!;

  const articleViews = events.filter((e) => e.event_type === "pageview" && e.article_slug);
  const articles: string[] = [];
  for (const e of articleViews) if (!articles.includes(e.article_slug!)) articles.push(e.article_slug!);
  const cta = [...events].reverse().find((e) => e.event_type === "cta_click") ?? null;

  return {
    status: "attributed",
    unknown_reason: null,
    first: toTouch(sessions[0]!),
    last: toTouch(lastTouch),
    first_article_slug: articleViews[0]?.article_slug ?? null,
    last_article_slug: articleViews[articleViews.length - 1]?.article_slug ?? null,
    articles_viewed: articles.slice(0, 50),
    signup_cta_id: cta?.cta_id ?? null,
    signup_cta_location: cta?.cta_location ?? null,
    signup_cta_path: cta?.path ?? null,
    sessions_before_signup: sessions.length,
  };
}

export function snapshotToRow(
  businessId: string,
  snap: AttributionSnapshot,
  signupAt: Date,
  visitorKey: string | null
) {
  const touch = (prefix: "ft" | "lt", t: Touch | null) => ({
    [`${prefix}_channel`]: t?.channel ?? null,
    [`${prefix}_referrer_host`]: t?.referrer_host ?? null,
    [`${prefix}_utm_source`]: t?.utm_source ?? null,
    [`${prefix}_utm_medium`]: t?.utm_medium ?? null,
    [`${prefix}_utm_campaign`]: t?.utm_campaign ?? null,
    [`${prefix}_utm_content`]: t?.utm_content ?? null,
    [`${prefix}_utm_term`]: t?.utm_term ?? null,
    [`${prefix}_landing_path`]: t?.landing_path ?? null,
    [`${prefix}_at`]: t?.at ?? null,
  });
  return {
    business_id: businessId,
    status: snap.status,
    unknown_reason: snap.unknown_reason,
    consent_mode: visitorKey ? "persistent" : null,
    visitor_key: snap.status === "attributed" ? visitorKey : null,
    ...touch("ft", snap.first),
    ...touch("lt", snap.last),
    first_article_slug: snap.first_article_slug,
    last_article_slug: snap.last_article_slug,
    articles_viewed: snap.articles_viewed,
    signup_cta_id: snap.signup_cta_id,
    signup_cta_location: snap.signup_cta_location,
    signup_cta_path: snap.signup_cta_path,
    sessions_before_signup: snap.sessions_before_signup,
    signup_at: signupAt.toISOString(),
  };
}

const UNKNOWN_NO_VISITOR: AttributionSnapshot = {
  status: "unknown",
  unknown_reason: "no_consented_visitor_cookie",
  first: null,
  last: null,
  first_article_slug: null,
  last_article_slug: null,
  articles_viewed: [],
  signup_cta_id: null,
  signup_cta_location: null,
  signup_cta_path: null,
  sessions_before_signup: 0,
};

/**
 * Server: record attribution for a newly created self-serve business. Never throws;
 * never overwrites an existing snapshot (first write wins).
 */
export async function recordSignupAttribution(businessId: string, signupAt = new Date()): Promise<void> {
  try {
    let visitorId: string | null = null;
    try {
      const raw = (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
      visitorId = raw && UUID_RE.test(raw) ? raw.toLowerCase() : null;
    } catch {
      visitorId = null; // no request scope (scripts)
    }

    const db = await createServiceClient();
    let snap = UNKNOWN_NO_VISITOR;
    const visitorKey = visitorId ? `v:${visitorId}` : null;

    if (visitorKey) {
      const until = signupAt.toISOString();
      const [{ data: sessions }, { data: events }] = await Promise.all([
        db
          .from("analytics_sessions")
          .select("id, started_at, channel, referrer_host, landing_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
          .eq("visitor_key", visitorKey)
          .lte("started_at", until)
          .order("started_at", { ascending: true })
          .limit(500),
        db
          .from("analytics_events")
          .select("session_id, event_type, path, article_slug, cta_id, cta_location, occurred_at")
          .eq("visitor_key", visitorKey)
          .lte("occurred_at", until)
          .order("occurred_at", { ascending: true })
          .limit(5000),
      ]);
      snap = buildAttributionSnapshot(
        (sessions ?? []) as AttributionSession[],
        (events ?? []) as AttributionEvent[],
        signupAt
      );
    }

    const { error } = await db
      .from("business_attribution")
      .upsert(snapshotToRow(businessId, snap, signupAt, visitorKey), { onConflict: "business_id", ignoreDuplicates: true });
    if (error) console.warn("[analytics] attribution insert failed", error.message);
  } catch (err) {
    console.warn("[analytics] attribution skipped", err instanceof Error ? err.message : err);
  }
}
