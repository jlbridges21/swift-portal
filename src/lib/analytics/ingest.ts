import { createHash, randomUUID } from "node:crypto";
import type { CollectPayload } from "@/lib/analytics/collect-schema";
import { classifyChannel, isOwnHost, referrerHostFrom, type Channel } from "@/lib/analytics/channels";
import { articleSlugForPath, deviceClass, normalizePath } from "@/lib/analytics/request-meta";

/**
 * Turns a validated collector payload into session + event rows. Storage is
 * injected so the logic is testable without a database (scripts/verify-analytics.ts).
 */

export const SESSION_IDLE_MS = 30 * 60 * 1000;

export type SessionRow = {
  id: string;
  visitor_key: string;
  consent_mode: "persistent" | "cookieless";
  started_at: string;
  landing_path: string;
  landing_article_slug: string | null;
  referrer_host: string | null;
  channel: Channel;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  device_class: "mobile" | "tablet" | "desktop" | "unknown";
};

export type EventRow = {
  client_event_id: string;
  session_id: string;
  visitor_key: string;
  event_type: CollectPayload["type"];
  path: string;
  article_slug: string | null;
  cta_id: string | null;
  cta_location: string | null;
  occurred_at: string;
};

export interface AnalyticsStore {
  /** Salt for the given UTC day (YYYY-MM-DD); created if missing. */
  getDailySalt(day: string): Promise<string>;
  /** Session id of this visitor's most recent event at or after `sinceIso`, if any. */
  findRecentSessionId(visitorKey: string, sinceIso: string): Promise<string | null>;
  /** Insert the session if its id is new; never overwrites an existing session. */
  ensureSession(row: SessionRow): Promise<void>;
  /** Insert the event; a duplicate client_event_id is silently ignored. */
  insertEvent(row: EventRow): Promise<void>;
}

export type IngestContext = {
  ip: string;
  userAgent: string;
  /** Sec-GPC: 1 — forces cookieless mode. */
  gpc: boolean;
  now: Date;
  platformRootDomain: string;
  knownArticleSlugs: ReadonlySet<string>;
};

export function cookielessVisitorKey(salt: string, ip: string, userAgent: string): string {
  return `c:${createHash("sha256").update(`sp-analytics:${salt}:${ip}:${userAgent}`).digest("hex").slice(0, 40)}`;
}

function nullable(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function ingestEvent(
  payload: CollectPayload,
  ctx: IngestContext,
  store: AnalyticsStore
): Promise<{ sessionId: string; visitorKey: string; mode: "persistent" | "cookieless" }> {
  const persistent = payload.mode === "persistent" && !ctx.gpc && !!payload.visitorId && !!payload.sessionId;
  const mode = persistent ? "persistent" : "cookieless";
  const nowIso = ctx.now.toISOString();

  let visitorKey: string;
  let sessionId: string;
  if (persistent) {
    visitorKey = `v:${payload.visitorId}`;
    sessionId = payload.sessionId!;
  } else {
    const salt = await store.getDailySalt(nowIso.slice(0, 10));
    visitorKey = cookielessVisitorKey(salt, ctx.ip, ctx.userAgent);
    const since = new Date(ctx.now.getTime() - SESSION_IDLE_MS).toISOString();
    sessionId = (await store.findRecentSessionId(visitorKey, since)) ?? randomUUID();
  }

  const path = normalizePath(payload.path);
  const articleSlug = articleSlugForPath(path, ctx.knownArticleSlugs);

  let referrerHost = referrerHostFrom(payload.referrer);
  if (isOwnHost(referrerHost, ctx.platformRootDomain)) referrerHost = null;
  const utm = {
    utm_source: nullable(payload.utm?.utm_source),
    utm_medium: nullable(payload.utm?.utm_medium),
    utm_campaign: nullable(payload.utm?.utm_campaign),
    utm_content: nullable(payload.utm?.utm_content),
    utm_term: nullable(payload.utm?.utm_term),
  };

  await store.ensureSession({
    id: sessionId,
    visitor_key: visitorKey,
    consent_mode: mode,
    started_at: nowIso,
    landing_path: path,
    landing_article_slug: articleSlug,
    referrer_host: referrerHost,
    channel: classifyChannel({ referrerHost, utm }),
    ...utm,
    device_class: deviceClass(ctx.userAgent),
  });

  await store.insertEvent({
    client_event_id: payload.eventId,
    session_id: sessionId,
    visitor_key: visitorKey,
    event_type: payload.type,
    path,
    article_slug: articleSlug,
    cta_id: payload.type === "cta_click" ? payload.cta?.id ?? null : null,
    cta_location: payload.type === "cta_click" ? payload.cta?.location ?? null : null,
    occurred_at: nowIso,
  });

  return { sessionId, visitorKey, mode };
}
