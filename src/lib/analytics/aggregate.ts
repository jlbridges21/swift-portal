import { CHANNELS, type Channel } from "@/lib/analytics/channels";
import { inRange, localDay, type ReportRange } from "@/lib/analytics/range";

/**
 * Pure report aggregation. Every number on /platform/analytics is computed here from
 * row sets loaded by report-data.ts, so the math is testable without a database
 * (scripts/verify-analytics.ts). Definitions: metrics-dictionary.ts.
 */

export type SessionRec = {
  id: string;
  visitor_key: string;
  consent_mode: "persistent" | "cookieless";
  started_at: string;
  landing_path: string;
  landing_article_slug: string | null;
  channel: Channel;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_class: string | null;
};

export type EventRec = {
  session_id: string;
  visitor_key: string;
  event_type: "pageview" | "cta_click" | "signup_start";
  path: string;
  article_slug: string | null;
  cta_id: string | null;
  cta_location: string | null;
  occurred_at: string;
};

export type BusinessRec = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_via: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  is_protected: boolean | null;
  deleted_at: string | null;
};

export type AttributionRec = {
  business_id: string;
  status: "attributed" | "unknown";
  unknown_reason: string | null;
  visitor_key: string | null;
  ft_channel: Channel | null;
  ft_referrer_host: string | null;
  ft_utm_source: string | null;
  ft_utm_campaign: string | null;
  ft_landing_path: string | null;
  ft_at: string | null;
  lt_channel: Channel | null;
  lt_referrer_host: string | null;
  lt_utm_source: string | null;
  lt_utm_campaign: string | null;
  lt_landing_path: string | null;
  lt_at: string | null;
  first_article_slug: string | null;
  last_article_slug: string | null;
  articles_viewed: string[] | null;
  signup_cta_id: string | null;
  signup_cta_location: string | null;
  signup_cta_path: string | null;
  sessions_before_signup: number | null;
  signup_at: string;
};

export type PaymentRec = { business_id: string; amount_paid_cents: number; paid_at: string };
export type LifecycleRec = { business_id: string; event_type: string; occurred_at: string };

export type AttributionModel = "first" | "last";

export type ReportInput = {
  range: ReportRange;
  now: Date;
  sessions: SessionRec[];
  events: EventRec[];
  businesses: BusinessRec[];
  attribution: AttributionRec[];
  /** business_id → earliest project created_at */
  firstProjectAt: Map<string, string>;
  payments: PaymentRec[];
  lifecycle: LifecycleRec[];
  articles: { slug: string; title: string }[];
  excludedBusinessIds: ReadonlySet<string>;
};

// ---------------------------------------------------------------- business lifecycle

/** Earliest timestamp per business (activation counts the FIRST project only, once). */
export function earliestByBusiness(rows: { business_id: string; created_at: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const cur = out.get(r.business_id);
    if (!cur || Date.parse(r.created_at) < Date.parse(cur)) out.set(r.business_id, r.created_at);
  }
  return out;
}

export type BusinessLifecycle = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
  firstPaidAt: string | null;
  subscriptionStatus: string | null;
  revenueCentsAllTime: number;
  attribution: AttributionRec | null;
};

/** Self-serve businesses only (excludes platform-created, protected, excluded ids, deleted). */
export function buildLifecycles(input: Pick<ReportInput, "businesses" | "attribution" | "firstProjectAt" | "payments" | "excludedBusinessIds">): BusinessLifecycle[] {
  const attr = new Map(input.attribution.map((a) => [a.business_id, a]));
  const firstPaid = new Map<string, string>();
  const revenue = new Map<string, number>();
  for (const p of input.payments) {
    if (p.amount_paid_cents <= 0) continue;
    const cur = firstPaid.get(p.business_id);
    if (!cur || p.paid_at < cur) firstPaid.set(p.business_id, p.paid_at);
    revenue.set(p.business_id, (revenue.get(p.business_id) ?? 0) + p.amount_paid_cents);
  }
  return input.businesses
    .filter((b) => b.created_via === "signup" && !b.is_protected && !b.deleted_at && !input.excludedBusinessIds.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      createdAt: b.created_at,
      // Self-serve trials start at registration; trial_ends_at is only set when the plan granted one.
      trialStartedAt: b.trial_ends_at ? b.created_at : null,
      trialEndsAt: b.trial_ends_at,
      activatedAt: input.firstProjectAt.get(b.id) ?? null,
      firstPaidAt: firstPaid.get(b.id) ?? null,
      subscriptionStatus: b.subscription_status,
      revenueCentsAllTime: revenue.get(b.id) ?? 0,
      attribution: attr.get(b.id) ?? null,
    }));
}

/** Channel credited under a model; anything without an attributed snapshot is "unknown". */
export function creditedChannel(l: BusinessLifecycle, model: AttributionModel): Channel {
  const a = l.attribution;
  if (!a || a.status !== "attributed") return "unknown";
  return (model === "first" ? a.ft_channel : a.lt_channel) ?? "unknown";
}

export function creditedArticle(l: BusinessLifecycle, model: AttributionModel): string | null {
  const a = l.attribution;
  if (!a || a.status !== "attributed") return null;
  return model === "first" ? a.first_article_slug : a.last_article_slug;
}

// ---------------------------------------------------------------- traffic

export type TrafficTotals = {
  visitors: number;
  consentedVisitors: number;
  sessions: number;
  pageviews: number;
  blogViews: number;
  ctaClicks: number;
  signupStarts: number;
};

export function trafficTotals(sessions: SessionRec[], events: EventRec[]): TrafficTotals {
  const visitors = new Set<string>();
  const consented = new Set<string>();
  for (const s of sessions) {
    visitors.add(s.visitor_key);
    if (s.consent_mode === "persistent") consented.add(s.visitor_key);
  }
  let pageviews = 0;
  let blogViews = 0;
  let ctaClicks = 0;
  const signupSessions = new Set<string>();
  for (const e of events) {
    if (e.event_type === "pageview") {
      pageviews++;
      if (e.article_slug) blogViews++;
    } else if (e.event_type === "cta_click") ctaClicks++;
    else if (e.event_type === "signup_start") signupSessions.add(e.session_id);
  }
  return {
    visitors: visitors.size,
    consentedVisitors: consented.size,
    sessions: sessions.length,
    pageviews,
    blogViews,
    ctaClicks,
    signupStarts: signupSessions.size,
  };
}

// ---------------------------------------------------------------- overview

export type Rate = { numerator: number; denominator: number; value: number | null; note?: string };

function rate(n: number, d: number, note?: string): Rate {
  return { numerator: n, denominator: d, value: d > 0 ? n / d : null, note };
}

export type Overview = TrafficTotals & {
  registrations: number;
  trials: number;
  activated: number;
  newPaid: number;
  revenueCents: number;
  attributedRevenueCents: number;
  unknownRevenueCents: number;
  cancellations: number;
  paymentFailures: number;
  visitorToSignup: Rate;
  signupToActivation: Rate;
  trialToPaid: Rate;
};

export function buildOverview(input: ReportInput, lifecycles: BusinessLifecycle[]): Overview {
  const r = input.range;
  const traffic = trafficTotals(input.sessions, input.events);
  const ids = new Set(lifecycles.map((l) => l.id));
  const byId = new Map(lifecycles.map((l) => [l.id, l]));

  const cohort = lifecycles.filter((l) => inRange(l.createdAt, r));
  const trialCohort = cohort.filter((l) => l.trialStartedAt);
  const stillTrialing = trialCohort.filter((l) => !l.firstPaidAt && l.trialEndsAt && Date.parse(l.trialEndsAt) > input.now.getTime()).length;

  // Consented-visitor cohort: persistent visitors with a session in range who registered at or after that visit.
  const consentedFirstSeen = new Map<string, number>();
  for (const s of input.sessions) {
    if (s.consent_mode !== "persistent") continue;
    const t = Date.parse(s.started_at);
    const cur = consentedFirstSeen.get(s.visitor_key);
    if (cur === undefined || t < cur) consentedFirstSeen.set(s.visitor_key, t);
  }
  let consentedConverted = 0;
  for (const a of input.attribution) {
    if (a.status !== "attributed" || !a.visitor_key || !ids.has(a.business_id)) continue;
    const seen = consentedFirstSeen.get(a.visitor_key);
    if (seen !== undefined && Date.parse(a.signup_at) >= seen) consentedConverted++;
  }

  let revenueCents = 0;
  let attributedRevenueCents = 0;
  for (const p of input.payments) {
    if (p.amount_paid_cents <= 0 || !inRange(p.paid_at, r) || !ids.has(p.business_id)) continue;
    revenueCents += p.amount_paid_cents;
    const l = byId.get(p.business_id);
    if (l?.attribution?.status === "attributed") attributedRevenueCents += p.amount_paid_cents;
  }

  return {
    ...traffic,
    registrations: cohort.length,
    trials: trialCohort.length,
    activated: lifecycles.filter((l) => inRange(l.activatedAt, r)).length,
    newPaid: lifecycles.filter((l) => inRange(l.firstPaidAt, r)).length,
    revenueCents,
    attributedRevenueCents,
    unknownRevenueCents: revenueCents - attributedRevenueCents,
    cancellations: input.lifecycle.filter((e) => e.event_type === "subscription_canceled" && ids.has(e.business_id) && inRange(e.occurred_at, r)).length,
    paymentFailures: input.lifecycle.filter((e) => e.event_type === "payment_failed" && ids.has(e.business_id) && inRange(e.occurred_at, r)).length,
    visitorToSignup: rate(consentedConverted, consentedFirstSeen.size, "Consented visitors only"),
    signupToActivation: rate(cohort.filter((l) => l.activatedAt).length, cohort.length, "Businesses registered in range"),
    trialToPaid: rate(
      trialCohort.filter((l) => l.firstPaidAt).length,
      trialCohort.length,
      stillTrialing > 0 ? `${stillTrialing} still in trial — cohort not final` : "Trials started in range"
    ),
  };
}

// ---------------------------------------------------------------- time series

export type DayPoint = {
  day: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  registrations: number;
  trials: number;
  newPaid: number;
  revenueCents: number;
};

export function buildTimeseries(input: ReportInput, lifecycles: BusinessLifecycle[]): DayPoint[] {
  const tz = input.range.tz;
  const points = new Map<string, DayPoint>(
    input.range.days.map((day) => [day, { day, visitors: 0, sessions: 0, pageviews: 0, registrations: 0, trials: 0, newPaid: 0, revenueCents: 0 }])
  );
  const visitorsPerDay = new Map<string, Set<string>>();
  for (const s of input.sessions) {
    const day = localDay(new Date(s.started_at), tz);
    const p = points.get(day);
    if (!p) continue;
    p.sessions++;
    const set = visitorsPerDay.get(day) ?? new Set<string>();
    set.add(s.visitor_key);
    visitorsPerDay.set(day, set);
  }
  for (const [day, set] of visitorsPerDay) points.get(day)!.visitors = set.size;
  for (const e of input.events) {
    if (e.event_type !== "pageview") continue;
    const p = points.get(localDay(new Date(e.occurred_at), tz));
    if (p) p.pageviews++;
  }
  const ids = new Set(lifecycles.map((l) => l.id));
  for (const l of lifecycles) {
    const reg = points.get(localDay(new Date(l.createdAt), tz));
    if (reg && inRange(l.createdAt, input.range)) {
      reg.registrations++;
      if (l.trialStartedAt) reg.trials++;
    }
    if (l.firstPaidAt && inRange(l.firstPaidAt, input.range)) {
      const p = points.get(localDay(new Date(l.firstPaidAt), tz));
      if (p) p.newPaid++;
    }
  }
  for (const pay of input.payments) {
    if (pay.amount_paid_cents <= 0 || !ids.has(pay.business_id) || !inRange(pay.paid_at, input.range)) continue;
    const p = points.get(localDay(new Date(pay.paid_at), tz));
    if (p) p.revenueCents += pay.amount_paid_cents;
  }
  return [...points.values()];
}

// ---------------------------------------------------------------- funnel

export type FunnelStage = { key: string; label: string; unit: string; count: number };

export function buildFunnel(overview: Overview): FunnelStage[] {
  return [
    { key: "visitors", label: "Visitors", unit: "unique visitors", count: overview.visitors },
    { key: "blog", label: "Blog engagement", unit: "blog pageviews", count: overview.blogViews },
    { key: "cta", label: "Signup CTA clicks", unit: "clicks", count: overview.ctaClicks },
    { key: "signup_start", label: "Signup started", unit: "sessions that opened /signup", count: overview.signupStarts },
    { key: "registered", label: "Account created", unit: "businesses", count: overview.registrations },
    { key: "trial", label: "Trial started", unit: "businesses", count: overview.trials },
    { key: "activated", label: "Activated", unit: "businesses (first project in range)", count: overview.activated },
    { key: "paid", label: "Paid subscriber", unit: "businesses (first payment in range)", count: overview.newPaid },
  ];
}

// ---------------------------------------------------------------- channels

export type ConversionCounts = {
  registrations: number;
  trials: number;
  activated: number;
  paid: number;
  revenueCents: number;
};

export type ChannelRow = ConversionCounts & {
  channel: Channel;
  sessions: number;
  visitors: number;
  ctaClicks: number;
};

/**
 * Counts for businesses REGISTERED in range (cohort), credited by `keysFor`.
 * Revenue = subscription payments COLLECTED in range from any business credited
 * to the key (registration date doesn't matter for revenue).
 */
function creditConversions(
  input: ReportInput,
  lifecycles: BusinessLifecycle[],
  keysFor: (l: BusinessLifecycle) => Iterable<string>
): Map<string, ConversionCounts> {
  const map = new Map<string, ConversionCounts>();
  const bucket = (key: string) => {
    let c = map.get(key);
    if (!c) map.set(key, (c = { registrations: 0, trials: 0, activated: 0, paid: 0, revenueCents: 0 }));
    return c;
  };
  const byId = new Map(lifecycles.map((l) => [l.id, l]));
  for (const l of lifecycles) {
    if (!inRange(l.createdAt, input.range)) continue;
    for (const key of keysFor(l)) {
      const c = bucket(key);
      c.registrations++;
      if (l.trialStartedAt) c.trials++;
      if (l.activatedAt) c.activated++;
      if (l.firstPaidAt) c.paid++;
    }
  }
  for (const p of input.payments) {
    if (p.amount_paid_cents <= 0 || !inRange(p.paid_at, input.range)) continue;
    const l = byId.get(p.business_id);
    if (!l) continue;
    for (const key of keysFor(l)) bucket(key).revenueCents += p.amount_paid_cents;
  }
  return map;
}

export function buildChannels(input: ReportInput, lifecycles: BusinessLifecycle[], model: AttributionModel): ChannelRow[] {
  const traffic = new Map<Channel, { sessions: number; visitors: Set<string>; ctaClicks: number }>();
  const sessionChannel = new Map<string, Channel>();
  for (const s of input.sessions) {
    sessionChannel.set(s.id, s.channel);
    const t = traffic.get(s.channel) ?? { sessions: 0, visitors: new Set<string>(), ctaClicks: 0 };
    t.sessions++;
    t.visitors.add(s.visitor_key);
    traffic.set(s.channel, t);
  }
  for (const e of input.events) {
    if (e.event_type !== "cta_click") continue;
    const ch = sessionChannel.get(e.session_id);
    if (ch) traffic.get(ch)!.ctaClicks++;
  }
  const conv = creditConversions(input, lifecycles, (l) => [creditedChannel(l, model)]);

  return CHANNELS.map((channel) => {
    const t = traffic.get(channel);
    const c = conv.get(channel);
    return {
      channel,
      sessions: t?.sessions ?? 0,
      visitors: t?.visitors.size ?? 0,
      ctaClicks: t?.ctaClicks ?? 0,
      registrations: c?.registrations ?? 0,
      trials: c?.trials ?? 0,
      activated: c?.activated ?? 0,
      paid: c?.paid ?? 0,
      revenueCents: c?.revenueCents ?? 0,
    };
  }).filter((r) => r.sessions > 0 || r.registrations > 0 || r.channel === "unknown");
}

// ---------------------------------------------------------------- articles

export type ArticleRow = {
  slug: string;
  title: string;
  visitors: number;
  /** Persistent-consent visitors only (the population attribution can link). */
  consentedVisitors: number;
  sessions: number;
  pageviews: number;
  ctaClicks: number;
  first: ConversionCounts;
  last: ConversionCounts;
  assisted: ConversionCounts;
};

const ZERO: ConversionCounts = { registrations: 0, trials: 0, activated: 0, paid: 0, revenueCents: 0 };

export function buildArticles(input: ReportInput, lifecycles: BusinessLifecycle[]): ArticleRow[] {
  const stats = new Map<string, { visitors: Set<string>; sessions: Set<string>; pageviews: number; cta: number }>();
  const get = (slug: string) => {
    let s = stats.get(slug);
    if (!s) stats.set(slug, (s = { visitors: new Set(), sessions: new Set(), pageviews: 0, cta: 0 }));
    return s;
  };
  for (const e of input.events) {
    if (e.event_type === "pageview" && e.article_slug) {
      const s = get(e.article_slug);
      s.pageviews++;
      s.visitors.add(e.visitor_key);
      s.sessions.add(e.session_id);
    } else if (e.event_type === "cta_click") {
      const m = /^\/blog\/([a-z0-9-]+)$/.exec(e.path);
      if (m) get(m[1]!).cta++;
    }
  }
  const first = creditConversions(input, lifecycles, (l) => {
    const s = creditedArticle(l, "first");
    return s ? [s] : [];
  });
  const last = creditConversions(input, lifecycles, (l) => {
    const s = creditedArticle(l, "last");
    return s ? [s] : [];
  });
  const assisted = creditConversions(input, lifecycles, (l) =>
    l.attribution?.status === "attributed" ? new Set(l.attribution.articles_viewed ?? []) : []
  );
  return input.articles.map(({ slug, title }) => {
    const s = stats.get(slug);
    return {
      slug,
      title,
      visitors: s?.visitors.size ?? 0,
      consentedVisitors: s ? [...s.visitors].filter((k) => k.startsWith("v:")).length : 0,
      sessions: s?.sessions.size ?? 0,
      pageviews: s?.pageviews ?? 0,
      ctaClicks: s?.cta ?? 0,
      first: first.get(slug) ?? ZERO,
      last: last.get(slug) ?? ZERO,
      assisted: assisted.get(slug) ?? ZERO,
    };
  });
}

export type ArticleDetail = {
  row: ArticleRow;
  daily: { day: string; pageviews: number; visitors: number }[];
  sources: { channel: Channel; sessions: number }[];
  ctas: { ctaId: string; location: string; clicks: number }[];
  accounts: {
    lifecycle: BusinessLifecycle;
    firstTouch: boolean;
    lastTouch: boolean;
    assisted: boolean;
  }[];
};

export function buildArticleDetail(input: ReportInput, lifecycles: BusinessLifecycle[], slug: string): ArticleDetail | null {
  const row = buildArticles(input, lifecycles).find((a) => a.slug === slug);
  if (!row) return null;
  const tz = input.range.tz;
  const daily = new Map(input.range.days.map((d) => [d, { day: d, pageviews: 0, visitors: new Set<string>() }]));
  const sessionIds = new Set<string>();
  for (const e of input.events) {
    if (e.event_type !== "pageview" || e.article_slug !== slug) continue;
    sessionIds.add(e.session_id);
    const d = daily.get(localDay(new Date(e.occurred_at), tz));
    if (d) {
      d.pageviews++;
      d.visitors.add(e.visitor_key);
    }
  }
  const sources = new Map<Channel, number>();
  for (const s of input.sessions) if (sessionIds.has(s.id)) sources.set(s.channel, (sources.get(s.channel) ?? 0) + 1);
  const ctas = new Map<string, { ctaId: string; location: string; clicks: number }>();
  for (const e of input.events) {
    if (e.event_type !== "cta_click" || e.path !== `/blog/${slug}`) continue;
    const key = `${e.cta_id}|${e.cta_location}`;
    const c = ctas.get(key) ?? { ctaId: e.cta_id ?? "unknown", location: e.cta_location ?? "unknown", clicks: 0 };
    c.clicks++;
    ctas.set(key, c);
  }
  const accounts = lifecycles
    .filter((l) => inRange(l.createdAt, input.range) && l.attribution?.status === "attributed")
    .map((l) => ({
      lifecycle: l,
      firstTouch: l.attribution!.first_article_slug === slug,
      lastTouch: l.attribution!.last_article_slug === slug,
      assisted: (l.attribution!.articles_viewed ?? []).includes(slug),
    }))
    .filter((a) => a.firstTouch || a.lastTouch || a.assisted);
  return {
    row,
    daily: [...daily.values()].map((d) => ({ day: d.day, pageviews: d.pageviews, visitors: d.visitors.size })),
    sources: [...sources.entries()].map(([channel, sessions]) => ({ channel, sessions })).sort((a, b) => b.sessions - a.sessions),
    ctas: [...ctas.values()].sort((a, b) => b.clicks - a.clicks),
    accounts,
  };
}

// ---------------------------------------------------------------- deltas

export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
