/**
 * Platform Economics — server loaders (super-admin only; service role).
 *
 * Data sources, in order of reliability (see docs/PLATFORM-ECONOMICS.md):
 *   Storage   MEASURED   storage.objects sizes, attributed by key prefix (daily snapshot)
 *             FALLBACK   SUM(media_assets.file_size) when migration V112 is not applied
 *   Egress    MEASURED   bytes streamed through ShootPortal routes (business_egress_daily)
 *             ESTIMATED  signed-URL deliveries (file size per issue), and — for days before
 *                        metering began — logged downloads × file size (media_downloads)
 *             NOT SEEN   gallery thumbnails / inline video playback fetched straight from the
 *                        Supabase CDN; these only show up on the Supabase invoice
 *   Revenue   ACTUAL     platform_subscription_payments (paid Stripe invoices)
 *             MRR        Stripe subscription unit amount (journey snapshot) normalized to /month
 *   Costs     ESTIMATED  usage × unit prices from platform_economics_settings
 *             ACTUAL     provider invoices recorded in platform_expense_entries
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/subscription";
import { parseCostAssumptions, type CostAssumptions, GB } from "@/lib/economics/assumptions";
import {
  addUsage,
  emptyUsage,
  marginalCost,
  platformCost,
  stripeFeesMonthly,
  type CostBreakdown,
  type UsageInput,
} from "@/lib/economics/cost-model";
import { parseScenario, type SimScenario } from "@/lib/economics/simulator";

type Db = Awaited<ReturnType<typeof createServiceClient>>;

const DAY_MS = 86_400_000;
export const EGRESS_WINDOW_DAYS = 30;
/** Snapshots older than this are recomputed on page load (cron normally runs daily). */
const SNAPSHOT_MAX_AGE_MS = 26 * 60 * 60 * 1000;

function isMissingRelation(message: string | undefined): boolean {
  if (!message) return false;
  return /does not exist|schema cache|Could not find the (table|function)|PGRST20[2-5]|42P01|42883/i.test(message);
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type EconomicsSettings = {
  assumptions: CostAssumptions;
  trackingStartedAt: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
  /** False until migration V112 is applied. */
  migrated: boolean;
};

export async function loadEconomicsSettings(db?: Db): Promise<EconomicsSettings> {
  const raw = db ?? (await createServiceClient());
  const { data, error } = await raw
    .from("platform_economics_settings")
    .select("pricing, tracking_started_at, updated_at, updated_by_email")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (!isMissingRelation(error.message)) console.error("[economics] settings load failed", error.message);
    return { assumptions: parseCostAssumptions(null), trackingStartedAt: null, updatedAt: null, updatedByEmail: null, migrated: false };
  }
  return {
    assumptions: parseCostAssumptions(data?.pricing),
    trackingStartedAt: (data?.tracking_started_at as string | null) ?? null,
    updatedAt: (data?.updated_at as string | null) ?? null,
    updatedByEmail: (data?.updated_by_email as string | null) ?? null,
    migrated: Boolean(data),
  };
}

export async function saveEconomicsSettings(pricing: unknown, actorEmail: string | null): Promise<CostAssumptions> {
  const assumptions = parseCostAssumptions(pricing);
  const raw = await createServiceClient();
  const { error } = await raw
    .from("platform_economics_settings")
    .upsert({ id: 1, pricing: assumptions, updated_at: new Date().toISOString(), updated_by_email: actorEmail }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return assumptions;
}

// ---------------------------------------------------------------------------
// Storage snapshots
// ---------------------------------------------------------------------------

export type StorageSnapshot = {
  day: string;
  computedAt: string;
  source: "storage_objects" | "media_assets";
  totalBytes: number;
  attributedBytes: number;
  unattributedBytes: number;
  objectCount: number;
  byBucket: Record<string, number>;
  byBusiness: Map<string, { bytes: number; objects: number; byBucket: Record<string, number> }>;
};

type UsageRow = { business_id: string | null; bucket_id: string; bytes: number | string; objects: number | string };

async function measureStorageFromObjects(raw: Db): Promise<StorageSnapshot | null> {
  const { data, error } = await raw.rpc("platform_storage_usage_by_business");
  if (error) {
    if (!isMissingRelation(error.message)) console.error("[economics] storage rpc failed", error.message);
    return null;
  }
  const byBusiness: StorageSnapshot["byBusiness"] = new Map();
  const byBucket: Record<string, number> = {};
  let total = 0;
  let attributed = 0;
  let objects = 0;
  for (const r of (data ?? []) as UsageRow[]) {
    const bytes = Number(r.bytes) || 0;
    const count = Number(r.objects) || 0;
    total += bytes;
    objects += count;
    byBucket[r.bucket_id] = (byBucket[r.bucket_id] ?? 0) + bytes;
    if (!r.business_id) continue;
    attributed += bytes;
    const cur = byBusiness.get(r.business_id) ?? { bytes: 0, objects: 0, byBucket: {} };
    cur.bytes += bytes;
    cur.objects += count;
    cur.byBucket[r.bucket_id] = (cur.byBucket[r.bucket_id] ?? 0) + bytes;
    byBusiness.set(r.business_id, cur);
  }
  const now = new Date();
  return {
    day: utcDay(now),
    computedAt: now.toISOString(),
    source: "storage_objects",
    totalBytes: total,
    attributedBytes: attributed,
    unattributedBytes: total - attributed,
    objectCount: objects,
    byBucket,
    byBusiness,
  };
}

/** Pre-migration fallback: original file sizes recorded on media rows (no thumbnails/derivatives). */
async function measureStorageFromMediaRows(raw: Db): Promise<StorageSnapshot> {
  const byBusiness: StorageSnapshot["byBusiness"] = new Map();
  let total = 0;
  let objects = 0;
  const PAGE = 1000;
  for (let from = 0; from < 500_000; from += PAGE) {
    const { data, error } = await raw
      .from("media_assets")
      .select("id, business_id, file_size")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const bytes = typeof r.file_size === "number" ? r.file_size : 0;
      total += bytes;
      objects += 1;
      const cur = byBusiness.get(r.business_id) ?? { bytes: 0, objects: 0, byBucket: {} };
      cur.bytes += bytes;
      cur.objects += 1;
      byBusiness.set(r.business_id, cur);
    }
    if (!data || data.length < PAGE) break;
  }
  const now = new Date();
  return {
    day: utcDay(now),
    computedAt: now.toISOString(),
    source: "media_assets",
    totalBytes: total,
    attributedBytes: total,
    unattributedBytes: 0,
    objectCount: objects,
    byBucket: {},
    byBusiness,
  };
}

async function readSnapshot(raw: Db, day: string): Promise<StorageSnapshot | null> {
  const [plat, biz] = await Promise.all([
    raw.from("platform_storage_snapshots").select("*").eq("day", day).maybeSingle(),
    raw.from("business_storage_snapshots").select("business_id, total_bytes, object_count, by_bucket").eq("day", day),
  ]);
  if (plat.error || !plat.data) return null;
  const byBusiness: StorageSnapshot["byBusiness"] = new Map();
  for (const r of biz.data ?? []) {
    byBusiness.set(r.business_id as string, {
      bytes: Number(r.total_bytes) || 0,
      objects: Number(r.object_count) || 0,
      byBucket: (r.by_bucket as Record<string, number>) ?? {},
    });
  }
  const p = plat.data;
  return {
    day: p.day as string,
    computedAt: p.computed_at as string,
    source: p.source as StorageSnapshot["source"],
    totalBytes: Number(p.total_bytes) || 0,
    attributedBytes: Number(p.attributed_bytes) || 0,
    unattributedBytes: Number(p.unattributed_bytes) || 0,
    objectCount: Number(p.object_count) || 0,
    byBucket: (p.by_bucket as Record<string, number>) ?? {},
    byBusiness,
  };
}

async function writeSnapshot(raw: Db, snap: StorageSnapshot, planLimits: Map<string, { plan: string; limitGb: number | null }>) {
  const { error } = await raw.from("platform_storage_snapshots").upsert(
    {
      day: snap.day,
      total_bytes: snap.totalBytes,
      attributed_bytes: snap.attributedBytes,
      unattributed_bytes: snap.unattributedBytes,
      object_count: snap.objectCount,
      by_bucket: snap.byBucket,
      source: snap.source,
      computed_at: snap.computedAt,
    },
    { onConflict: "day" }
  );
  if (error) {
    if (!isMissingRelation(error.message)) console.error("[economics] snapshot write failed", error.message);
    return;
  }
  const rows = [...snap.byBusiness.entries()].map(([businessId, v]) => ({
    day: snap.day,
    business_id: businessId,
    total_bytes: v.bytes,
    object_count: v.objects,
    by_bucket: v.byBucket,
    storage_limit_gb: planLimits.get(businessId)?.limitGb ?? null,
    plan: planLimits.get(businessId)?.plan ?? null,
    computed_at: snap.computedAt,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: bErr } = await raw.from("business_storage_snapshots").upsert(rows.slice(i, i + 500), { onConflict: "day,business_id" });
    if (bErr) console.error("[economics] business snapshot write failed", bErr.message);
  }
}

/**
 * Today's storage snapshot. Reads the stored one when fresh; otherwise measures (one scan of
 * storage.objects) and stores it. `force` always re-measures.
 */
export async function ensureStorageSnapshot(opts?: { force?: boolean; db?: Db }): Promise<StorageSnapshot> {
  const raw = opts?.db ?? (await createServiceClient());
  if (!opts?.force) {
    const { data: latest, error } = await raw
      .from("platform_storage_snapshots")
      .select("day, computed_at")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && latest && Date.now() - new Date(latest.computed_at as string).getTime() < SNAPSHOT_MAX_AGE_MS) {
      const snap = await readSnapshot(raw, latest.day as string);
      if (snap) return snap;
    }
  }
  const measured = (await measureStorageFromObjects(raw)) ?? (await measureStorageFromMediaRows(raw));
  if (measured.source === "storage_objects") {
    const plans = await loadBusinessPlanLimits(raw);
    await writeSnapshot(raw, measured, plans);
  }
  return measured;
}

/** Bytes per business on the snapshot closest to (at or before) `daysAgo` days back. */
async function loadSnapshotNear(raw: Db, daysAgo: number): Promise<{ day: string; byBusiness: Map<string, number>; total: number } | null> {
  const target = utcDay(new Date(Date.now() - daysAgo * DAY_MS));
  const { data, error } = await raw
    .from("platform_storage_snapshots")
    .select("day, total_bytes")
    .lte("day", target)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const { data: rows } = await raw.from("business_storage_snapshots").select("business_id, total_bytes").eq("day", data.day as string);
  return {
    day: data.day as string,
    total: Number(data.total_bytes) || 0,
    byBusiness: new Map((rows ?? []).map((r) => [r.business_id as string, Number(r.total_bytes) || 0])),
  };
}

// ---------------------------------------------------------------------------
// Plans & businesses
// ---------------------------------------------------------------------------

type PlanInfo = { key: string; name: string; storageGb: number | null; monthlyCents: number | null; annualMonthlyCents: number | null; isActive: boolean };

async function loadPlans(raw: Db): Promise<Map<string, PlanInfo>> {
  const { data } = await raw.from("plans").select("key, name, limits, price_monthly_cents, price_annual_cents, is_active");
  return new Map(
    (data ?? []).map((p) => {
      const limits = (p.limits ?? {}) as { storage_gb?: unknown };
      return [
        p.key as string,
        {
          key: p.key as string,
          name: p.name as string,
          storageGb: typeof limits.storage_gb === "number" ? limits.storage_gb : null,
          monthlyCents: (p.price_monthly_cents as number | null) ?? null,
          annualMonthlyCents: (p.price_annual_cents as number | null) ?? null,
          isActive: p.is_active === true,
        },
      ];
    })
  );
}

async function loadBusinessPlanLimits(raw: Db) {
  const [plans, { data }] = await Promise.all([loadPlans(raw), raw.from("businesses").select("id, plan")]);
  return new Map(
    (data ?? []).map((b) => [b.id as string, { plan: b.plan as string, limitGb: plans.get(b.plan as string)?.storageGb ?? null }])
  );
}

// ---------------------------------------------------------------------------
// Egress
// ---------------------------------------------------------------------------

export type EgressWindow = {
  windowDays: number;
  from: string;
  /** Days inside the window covered by the metering table. */
  meteredDays: number;
  byBusiness: Map<string, EgressTotals>;
};

export type EgressTotals = {
  proxiedBytes: number;
  zipBytes: number;
  signedBytes: number;
  requests: number;
  imageTransforms: number;
  /** Logged downloads × file size, for window days before metering began (estimate). */
  backfillBytes: number;
  backfillDownloads: number;
};

function emptyEgress(): EgressTotals {
  return { proxiedBytes: 0, zipBytes: 0, signedBytes: 0, requests: 0, imageTransforms: 0, backfillBytes: 0, backfillDownloads: 0 };
}

export async function loadEgressWindow(trackingStartedAt: string | null, days = EGRESS_WINDOW_DAYS, db?: Db): Promise<EgressWindow> {
  const raw = db ?? (await createServiceClient());
  const now = Date.now();
  const fromMs = now - days * DAY_MS;
  const from = new Date(fromMs).toISOString();
  const trackStartMs = trackingStartedAt ? new Date(trackingStartedAt).getTime() : now;
  const meteredFromMs = Math.max(fromMs, trackStartMs);
  const meteredDays = Math.max(0, Math.min(days, (now - meteredFromMs) / DAY_MS));
  const byBusiness = new Map<string, EgressTotals>();
  const get = (id: string) => {
    const cur = byBusiness.get(id) ?? emptyEgress();
    byBusiness.set(id, cur);
    return cur;
  };

  if (trackingStartedAt) {
    const { data, error } = await raw
      .from("business_egress_daily")
      .select("business_id, channel, bytes, requests, image_transforms")
      .gte("day", utcDay(new Date(fromMs)));
    if (error && !isMissingRelation(error.message)) console.error("[economics] egress load failed", error.message);
    for (const r of data ?? []) {
      const e = get(r.business_id as string);
      const bytes = Number(r.bytes) || 0;
      if (r.channel === "proxied_download") e.proxiedBytes += bytes;
      else if (r.channel === "zip_download") e.zipBytes += bytes;
      else e.signedBytes += bytes;
      e.requests += Number(r.requests) || 0;
      e.imageTransforms += Number(r.image_transforms) || 0;
    }
  }

  // Days before metering: estimate from the download log (single-file downloads only).
  if (meteredFromMs > fromMs + 60_000) {
    const { data, error } = await raw.rpc("platform_download_estimates", {
      p_from: from,
      p_to: new Date(meteredFromMs).toISOString(),
    });
    if (!error) {
      for (const r of (data ?? []) as { business_id: string | null; downloads: number; est_bytes: number }[]) {
        if (!r.business_id) continue;
        const e = get(r.business_id);
        e.backfillBytes += Number(r.est_bytes) || 0;
        e.backfillDownloads += Number(r.downloads) || 0;
      }
    } else if (isMissingRelation(error.message)) {
      // Pre-migration fallback: same estimate computed here, bounded to the window.
      const { data: logs } = await raw
        .from("media_downloads")
        .select("business_id, media_asset_id")
        .gte("created_at", from)
        .lt("created_at", new Date(meteredFromMs).toISOString())
        .limit(20_000);
      const ids = [...new Set((logs ?? []).map((l) => l.media_asset_id as string))];
      const sizes = new Map<string, { size: number; businessId: string }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: assets } = await raw.from("media_assets").select("id, file_size, business_id").in("id", ids.slice(i, i + 200));
        for (const a of assets ?? []) sizes.set(a.id as string, { size: Number(a.file_size) || 0, businessId: a.business_id as string });
      }
      for (const l of logs ?? []) {
        const asset = sizes.get(l.media_asset_id as string);
        const businessId = (l.business_id as string | null) ?? asset?.businessId;
        if (!businessId || !asset) continue;
        const e = get(businessId);
        e.backfillBytes += asset.size;
        e.backfillDownloads += 1;
      }
    }
  }

  return { windowDays: days, from, meteredDays, byBusiness };
}

/** Egress for the window as cost-model usage (proxied = proxied + zip + backfill). */
export function egressUsage(e: EgressTotals | undefined): Omit<UsageInput, "storageBytes"> {
  if (!e) return { proxiedBytes: 0, signedBytes: 0, imageTransforms: 0 };
  return {
    proxiedBytes: e.proxiedBytes + e.zipBytes + e.backfillBytes,
    signedBytes: e.signedBytes,
    imageTransforms: e.imageTransforms,
  };
}

// ---------------------------------------------------------------------------
// Business economics rows
// ---------------------------------------------------------------------------

export type BillingInterval = "monthly" | "annual";

export type BusinessEconomicsRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planName: string;
  status: string;
  deleted: boolean;
  subscriptionStatus: string;
  isComped: boolean;
  isPaying: boolean;
  interval: BillingInterval | null;
  /** Subscription list amount normalized to a month (dollars), paying businesses only. */
  mrr: number;
  /** Most recent paid invoice, normalized to a month (dollars) — reflects discounts. */
  lastInvoiceMonthly: number | null;
  lastPaidAt: string | null;
  collectedLifetime: number;
  introOfferRedeemed: boolean;
  referredByPartner: boolean;
  storageBytes: number;
  storageByBucket: Record<string, number>;
  allowanceGb: number | null;
  /** storageBytes ÷ allowance (0–1+), null when the plan has no limit. */
  utilization: number | null;
  /** Change vs the snapshot ~30 days ago; null when no older snapshot exists. */
  storageGrowthBytes: number | null;
  egress: EgressTotals;
  /** Egress for the window scaled to 30 days (dollars computed on this). */
  monthlyEgressBytes: number;
  usage: UsageInput;
  cost: CostBreakdown;
  stripeFees: number;
  /** mrr − infrastructure − Stripe fees (dollars / month). */
  contribution: number;
  margin: number | null;
};

export type EconomicsDataset = {
  generatedAt: string;
  settings: EconomicsSettings;
  snapshot: StorageSnapshot;
  growthBaseline: { day: string; total: number } | null;
  egressWindow: Omit<EgressWindow, "byBusiness">;
  rows: BusinessEconomicsRow[];
  plans: PlanInfo[];
  platform: ReturnType<typeof summarizePlatform>;
};

export async function loadEconomicsDataset(opts?: { forceSnapshot?: boolean }): Promise<EconomicsDataset> {
  const raw = await createServiceClient();
  const settings = await loadEconomicsSettings(raw);
  const a = settings.assumptions;

  const [snapshot, baseline, egress, plans, bizRes, journeyRes, payRes] = await Promise.all([
    ensureStorageSnapshot({ force: opts?.forceSnapshot, db: raw }),
    loadSnapshotNear(raw, 30),
    loadEgressWindow(settings.trackingStartedAt, EGRESS_WINDOW_DAYS, raw),
    loadPlans(raw),
    raw
      .from("businesses")
      .select(
        "id, name, slug, plan, status, deleted_at, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, referred_by_partner_id"
      )
      .order("created_at", { ascending: true }),
    raw.from("business_billing_journey").select("business_id, subscription_interval, subscription_amount_cents, intro_offer_redeemed_at"),
    raw.from("platform_subscription_payments").select("business_id, amount_paid_cents, paid_at").order("paid_at", { ascending: false }),
  ]);
  if (bizRes.error) throw new Error(bizRes.error.message);

  const journeys = new Map((journeyRes.data ?? []).map((j) => [j.business_id as string, j]));
  const payments = new Map<string, { last: { amount: number; paidAt: string } | null; total: number }>();
  for (const p of payRes.data ?? []) {
    const cur = payments.get(p.business_id as string) ?? { last: null, total: 0 };
    const amt = Number(p.amount_paid_cents) || 0;
    cur.total += amt;
    if (!cur.last) cur.last = { amount: amt, paidAt: p.paid_at as string };
    payments.set(p.business_id as string, cur);
  }

  // Egress scaling: when fewer than 30 days are observed (metered + backfill always covers the
  // full window, so scale is 1 unless the download log itself is younger).
  const growthOk = baseline && baseline.day !== snapshot.day;

  const rows: BusinessEconomicsRow[] = (bizRes.data ?? []).map((b) => {
    const sub = getSubscriptionState(b);
    const plan = plans.get(b.plan as string);
    const journey = journeys.get(b.id as string);
    const status = b.subscription_status as string;
    const isPaying = (status === "active" || status === "past_due") && !sub.isComped;
    const interval: BillingInterval | null =
      journey?.subscription_interval === "annual" ? "annual" : journey?.subscription_interval === "monthly" ? "monthly" : isPaying ? "monthly" : null;
    const months = interval === "annual" ? 12 : 1;
    const invoiceCents =
      typeof journey?.subscription_amount_cents === "number"
        ? journey.subscription_amount_cents
        : interval === "annual" && plan?.annualMonthlyCents != null
          ? plan.annualMonthlyCents * 12
          : (plan?.monthlyCents ?? 0);
    const mrr = isPaying ? invoiceCents / 100 / months : 0;
    const pay = payments.get(b.id as string);

    const stored = snapshot.byBusiness.get(b.id as string);
    const storageBytes = stored?.bytes ?? 0;
    const allowanceGb = plan?.storageGb ?? null;
    const e = egress.byBusiness.get(b.id as string) ?? emptyEgress();
    const eu = egressUsage(e);
    const usage: UsageInput = { storageBytes, ...eu };
    const cost = marginalCost(usage, a);
    const stripeFees = isPaying ? stripeFeesMonthly(invoiceCents, months, a) : 0;
    const contribution = mrr - cost.total - stripeFees;
    const prev = growthOk ? baseline!.byBusiness.get(b.id as string) : undefined;

    return {
      id: b.id as string,
      name: b.name as string,
      slug: b.slug as string,
      plan: b.plan as string,
      planName: plan?.name ?? (b.plan as string),
      status: b.status as string,
      deleted: Boolean(b.deleted_at),
      subscriptionStatus: status,
      isComped: sub.isComped,
      isPaying,
      interval,
      mrr,
      lastInvoiceMonthly: pay?.last ? pay.last.amount / 100 / months : null,
      lastPaidAt: pay?.last?.paidAt ?? null,
      collectedLifetime: (pay?.total ?? 0) / 100,
      introOfferRedeemed: Boolean(journey?.intro_offer_redeemed_at),
      referredByPartner: Boolean(b.referred_by_partner_id),
      storageBytes,
      storageByBucket: stored?.byBucket ?? {},
      allowanceGb,
      utilization: allowanceGb && allowanceGb > 0 ? storageBytes / (allowanceGb * GB) : null,
      storageGrowthBytes: growthOk ? storageBytes - (prev ?? 0) : null,
      egress: e,
      monthlyEgressBytes: eu.proxiedBytes + eu.signedBytes,
      usage,
      cost,
      stripeFees,
      contribution,
      margin: mrr > 0 ? contribution / mrr : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    settings,
    snapshot,
    growthBaseline: growthOk ? { day: baseline!.day, total: baseline!.total } : null,
    egressWindow: { windowDays: egress.windowDays, from: egress.from, meteredDays: egress.meteredDays },
    rows,
    plans: [...plans.values()],
    platform: summarizePlatform(rows, snapshot, a),
  };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function summarizePlatform(rows: BusinessEconomicsRow[], snap: StorageSnapshot, a: CostAssumptions) {
  const live = rows.filter((r) => r.status === "active" && !r.deleted);
  const paying = rows.filter((r) => r.isPaying);
  const usage = rows.reduce((acc, r) => addUsage(acc, r.usage), emptyUsage());
  // Unattributed bytes are still billed: include them at platform level.
  const platformUsage: UsageInput = { ...usage, storageBytes: snap.totalBytes };
  const cost = platformCost(platformUsage, a);
  const mrr = paying.reduce((s, r) => s + r.mrr, 0);
  const stripeFees = paying.reduce((s, r) => s + r.stripeFees, 0);
  const allowanceGb = live.reduce((s, r) => s + (r.allowanceGb ?? 0), 0);
  const withAllowance = live.filter((r) => r.utilization != null);
  const utils = withAllowance.map((r) => r.utilization!);
  const liveStorage = live.map((r) => r.storageBytes);
  const annualPaying = paying.filter((r) => r.interval === "annual").length;
  const egressBytes = usage.proxiedBytes + usage.signedBytes;
  return {
    businesses: rows.length,
    live: live.length,
    paying: paying.length,
    mrr,
    arr: mrr * 12,
    stripeFees,
    storageBytes: snap.totalBytes,
    attributedBytes: snap.attributedBytes,
    unattributedBytes: snap.unattributedBytes,
    allowanceBytes: allowanceGb * GB,
    allocatedUtilization: allowanceGb > 0 ? snap.attributedBytes / (allowanceGb * GB) : null,
    avgUtilization: utils.length ? utils.reduce((s, u) => s + u, 0) / utils.length : null,
    medianUtilization: median(utils),
    avgStorageBytes: liveStorage.length ? liveStorage.reduce((s, b) => s + b, 0) / liveStorage.length : 0,
    medianStorageBytes: median(liveStorage) ?? 0,
    egressBytes,
    proxiedBytes: usage.proxiedBytes,
    signedBytes: usage.signedBytes,
    imageTransforms: usage.imageTransforms,
    downloadRatio: snap.totalBytes > 0 ? egressBytes / snap.totalBytes : null,
    proxiedShare: egressBytes > 0 ? usage.proxiedBytes / egressBytes : null,
    annualShare: paying.length ? annualPaying / paying.length : null,
    cost,
    /** Customer-level marginal sum (no quotas). */
    marginalCostTotal: rows.reduce((s, r) => s + r.cost.total, 0),
    contributionAfterUsage: mrr - cost.usage - stripeFees,
    contributionAfterFixed: mrr - cost.total - stripeFees,
    avgRevenuePerPaying: paying.length ? mrr / paying.length : null,
    avgCostPerBusiness: live.length ? live.reduce((s, r) => s + r.cost.total, 0) / live.length : null,
  };
}

export type PlatformSummary = EconomicsDataset["platform"];

/** Lightweight per-business economics for the /platform table (no history). */
export async function loadBusinessEconomicsMap(): Promise<{
  rows: Map<string, Pick<BusinessEconomicsRow, "storageBytes" | "allowanceGb" | "utilization" | "cost" | "monthlyEgressBytes" | "mrr" | "contribution">>;
  source: StorageSnapshot["source"];
  computedAt: string;
} | null> {
  try {
    const ds = await loadEconomicsDataset();
    return {
      rows: new Map(ds.rows.map((r) => [r.id, r])),
      source: ds.snapshot.source,
      computedAt: ds.snapshot.computedAt,
    };
  } catch (err) {
    console.error("[economics] business map failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// History (monthly)
// ---------------------------------------------------------------------------

export type MonthlyPoint = {
  month: string; // YYYY-MM-01
  /** Bytes uploaded this month (media still stored). */
  uploadedBytes: number;
  /** Cumulative uploads of media still stored at month end (reconstruction). */
  reconstructedStorageBytes: number;
  /** Measured storage on the last snapshot of the month, if any. */
  snapshotStorageBytes: number | null;
  /** Logged-download estimate (bytes) for months before metering, metered bytes after. */
  downloadBytes: number;
  downloadSource: "estimated" | "metered" | "mixed" | "none";
  revenue: number;
  payingBusinesses: number;
  estimatedInfraCost: number;
  recordedExpenses: number;
};

export async function loadEconomicsHistory(settings: EconomicsSettings, months = 12): Promise<{ points: MonthlyPoint[]; available: boolean }> {
  const raw = await createServiceClient();
  const a = settings.assumptions;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const keys: string[] = [];
  for (let i = 0; i < months; i++) keys.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 10));

  const [media, downloads, egress, snaps, pays, expenses] = await Promise.all([
    raw.rpc("platform_media_monthly"),
    raw.rpc("platform_download_estimates", {
      p_from: start.toISOString(),
      p_to: settings.trackingStartedAt ?? now.toISOString(),
    }),
    raw.from("business_egress_daily").select("day, bytes").gte("day", keys[0]!),
    raw.from("platform_storage_snapshots").select("day, total_bytes").gte("day", keys[0]!).order("day", { ascending: true }),
    raw.from("platform_subscription_payments").select("business_id, amount_paid_cents, paid_at").gte("paid_at", start.toISOString()),
    raw.from("platform_expense_entries").select("month, amount_cents").gte("month", keys[0]!),
  ]);
  if (media.error && isMissingRelation(media.error.message)) return { points: [], available: false };

  const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
  const uploaded = new Map<string, number>();
  let before = 0;
  for (const r of (media.data ?? []) as { month: string; bytes: number }[]) {
    const m = monthOf(r.month);
    if (m < keys[0]!) before += Number(r.bytes) || 0;
    else uploaded.set(m, (uploaded.get(m) ?? 0) + (Number(r.bytes) || 0));
  }
  const est = new Map<string, number>();
  for (const r of (downloads.data ?? []) as { month: string; est_bytes: number }[]) {
    const m = monthOf(r.month);
    est.set(m, (est.get(m) ?? 0) + (Number(r.est_bytes) || 0));
  }
  const metered = new Map<string, number>();
  for (const r of egress.data ?? []) {
    const m = monthOf(r.day as string);
    metered.set(m, (metered.get(m) ?? 0) + (Number(r.bytes) || 0));
  }
  const snapByMonth = new Map<string, number>();
  for (const r of snaps.data ?? []) snapByMonth.set(monthOf(r.day as string), Number(r.total_bytes) || 0);
  const rev = new Map<string, number>();
  const payers = new Map<string, Set<string>>();
  for (const p of pays.data ?? []) {
    const m = monthOf(p.paid_at as string);
    rev.set(m, (rev.get(m) ?? 0) + (Number(p.amount_paid_cents) || 0) / 100);
    const set = payers.get(m) ?? new Set<string>();
    set.add(p.business_id as string);
    payers.set(m, set);
  }
  const exp = new Map<string, number>();
  for (const e of expenses.data ?? []) {
    const m = monthOf(e.month as string);
    exp.set(m, (exp.get(m) ?? 0) + (Number(e.amount_cents) || 0) / 100);
  }

  let cumulative = before;
  const points = keys.map((m) => {
    cumulative += uploaded.get(m) ?? 0;
    const e = est.get(m) ?? 0;
    const mt = metered.get(m) ?? 0;
    const downloadBytes = e + mt;
    const storageBytes = snapByMonth.get(m) ?? cumulative;
    const cost = platformCost({ storageBytes, proxiedBytes: downloadBytes, signedBytes: 0, imageTransforms: 0 }, a);
    return {
      month: m,
      uploadedBytes: uploaded.get(m) ?? 0,
      reconstructedStorageBytes: cumulative,
      snapshotStorageBytes: snapByMonth.get(m) ?? null,
      downloadBytes,
      downloadSource: (e && mt ? "mixed" : mt ? "metered" : e ? "estimated" : "none") as MonthlyPoint["downloadSource"],
      revenue: rev.get(m) ?? 0,
      payingBusinesses: payers.get(m)?.size ?? 0,
      estimatedInfraCost: cost.total,
      recordedExpenses: exp.get(m) ?? 0,
    };
  });
  return { points, available: true };
}

// ---------------------------------------------------------------------------
// Recorded expenses (actual invoices)
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = [
  "supabase_storage",
  "supabase_egress",
  "supabase_compute",
  "supabase_base",
  "supabase_image_transforms",
  "supabase_other",
  "vercel",
  "stripe_fees",
  "email",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_COST_TYPES = ["usage_shared", "fixed", "attributable"] as const;
export type ExpenseCostType = (typeof EXPENSE_COST_TYPES)[number];

export type ExpenseEntry = {
  id: string;
  month: string;
  provider: string;
  category: ExpenseCategory;
  costType: ExpenseCostType;
  amountCents: number;
  notes: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

export async function listExpenseEntries(): Promise<ExpenseEntry[] | null> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("platform_expense_entries")
    .select("*")
    .order("month", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelation(error.message)) return null;
    throw new Error(error.message);
  }
  return (data ?? []).map((e) => ({
    id: e.id as string,
    month: e.month as string,
    provider: e.provider as string,
    category: e.category as ExpenseCategory,
    costType: e.cost_type as ExpenseCostType,
    amountCents: Number(e.amount_cents) || 0,
    notes: (e.notes as string | null) ?? null,
    createdByEmail: (e.created_by_email as string | null) ?? null,
    createdAt: e.created_at as string,
  }));
}

export function parseExpenseInput(body: unknown) {
  const o = (body ?? {}) as Record<string, unknown>;
  const month = typeof o.month === "string" && /^\d{4}-\d{2}$/.test(o.month) ? `${o.month}-01` : null;
  const provider = typeof o.provider === "string" ? o.provider.trim().slice(0, 80) : "";
  const category = EXPENSE_CATEGORIES.includes(o.category as ExpenseCategory) ? (o.category as ExpenseCategory) : null;
  const costType = EXPENSE_COST_TYPES.includes(o.costType as ExpenseCostType) ? (o.costType as ExpenseCostType) : null;
  const amount = typeof o.amount === "number" ? o.amount : Number(o.amount);
  const notes = typeof o.notes === "string" && o.notes.trim() ? o.notes.trim().slice(0, 500) : null;
  if (!month) throw new Error("Month must be YYYY-MM.");
  if (!provider) throw new Error("Provider is required.");
  if (!category) throw new Error("Pick a category.");
  if (!costType) throw new Error("Pick a cost type.");
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) throw new Error("Amount must be a positive dollar value.");
  return { month, provider, category, costType, amountCents: Math.round(amount * 100), notes };
}

export async function createExpenseEntry(input: ReturnType<typeof parseExpenseInput>, actorEmail: string | null) {
  const raw = await createServiceClient();
  const { error } = await raw.from("platform_expense_entries").insert({
    month: input.month,
    provider: input.provider,
    category: input.category,
    cost_type: input.costType,
    amount_cents: input.amountCents,
    notes: input.notes,
    created_by_email: actorEmail,
  });
  if (error) throw new Error(error.message);
}

export async function deleteExpenseEntry(id: string) {
  const raw = await createServiceClient();
  const { error } = await raw.from("platform_expense_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Saved scenarios (analysis only — never read by billing code)
// ---------------------------------------------------------------------------

export type SavedScenario = { id: string; name: string; description: string | null; config: SimScenario; updatedAt: string; createdByEmail: string | null };

export async function listSavedScenarios(): Promise<SavedScenario[] | null> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("platform_pricing_scenarios")
    .select("id, name, description, config, updated_at, created_by_email")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingRelation(error.message)) return null;
    throw new Error(error.message);
  }
  return (data ?? []).flatMap((r) => {
    const config = parseScenario(r.config);
    if (!config) return [];
    return [{
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      config: { ...config, id: r.id as string, name: r.name as string },
      updatedAt: r.updated_at as string,
      createdByEmail: (r.created_by_email as string | null) ?? null,
    }];
  });
}

export async function saveScenario(input: { id?: string | null; config: unknown; description?: unknown }, actorEmail: string | null): Promise<SavedScenario> {
  const config = parseScenario(input.config);
  if (!config) throw new Error("Scenario needs at least one tier.");
  const description = typeof input.description === "string" && input.description.trim() ? input.description.trim().slice(0, 500) : null;
  const raw = await createServiceClient();
  const payload = { name: config.name, description, config, updated_at: new Date().toISOString() };
  const isUuid = typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id);
  const res = isUuid
    ? await raw.from("platform_pricing_scenarios").update(payload).eq("id", input.id!).select("id, updated_at").maybeSingle()
    : await raw.from("platform_pricing_scenarios").insert({ ...payload, created_by_email: actorEmail }).select("id, updated_at").single();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) throw new Error("Scenario not found.");
  return {
    id: res.data.id as string,
    name: config.name,
    description,
    config: { ...config, id: res.data.id as string },
    updatedAt: res.data.updated_at as string,
    createdByEmail: actorEmail,
  };
}

export async function deleteScenario(id: string) {
  const raw = await createServiceClient();
  const { error } = await raw.from("platform_pricing_scenarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Per-business history (drill-down)
// ---------------------------------------------------------------------------

export type BusinessEconomicsHistory = {
  storage: { day: string; bytes: number }[];
  egress: { day: string; bytes: number; requests: number }[];
  payments: { amountCents: number; paidAt: string }[];
  uploadsByMonth: { month: string; bytes: number }[];
};

export async function loadBusinessEconomicsHistory(businessId: string): Promise<BusinessEconomicsHistory> {
  const raw = await createServiceClient();
  const since = utcDay(new Date(Date.now() - 180 * DAY_MS));
  const [storage, egress, payments, media] = await Promise.all([
    raw
      .from("business_storage_snapshots")
      .select("day, total_bytes")
      .eq("business_id", businessId)
      .gte("day", since)
      .order("day", { ascending: true }),
    raw
      .from("business_egress_daily")
      .select("day, bytes, requests")
      .eq("business_id", businessId)
      .gte("day", since)
      .order("day", { ascending: true }),
    raw
      .from("platform_subscription_payments")
      .select("amount_paid_cents, paid_at")
      .eq("business_id", businessId)
      .order("paid_at", { ascending: false })
      .limit(24),
    raw.rpc("platform_media_monthly"),
  ]);
  const egressByDay = new Map<string, { bytes: number; requests: number }>();
  for (const r of egress.data ?? []) {
    const cur = egressByDay.get(r.day as string) ?? { bytes: 0, requests: 0 };
    cur.bytes += Number(r.bytes) || 0;
    cur.requests += Number(r.requests) || 0;
    egressByDay.set(r.day as string, cur);
  }
  return {
    storage: (storage.data ?? []).map((r) => ({ day: r.day as string, bytes: Number(r.total_bytes) || 0 })),
    egress: [...egressByDay.entries()].map(([day, v]) => ({ day, ...v })),
    payments: (payments.data ?? []).map((p) => ({ amountCents: Number(p.amount_paid_cents) || 0, paidAt: p.paid_at as string })),
    uploadsByMonth: ((media.data ?? []) as { month: string; business_id: string; bytes: number }[])
      .filter((r) => r.business_id === businessId)
      .map((r) => ({ month: `${String(r.month).slice(0, 7)}-01`, bytes: Number(r.bytes) || 0 }))
      .sort((x, y) => x.month.localeCompare(y.month))
      .slice(-12),
  };
}
