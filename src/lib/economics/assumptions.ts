/**
 * Platform Economics — unit prices and cost assumptions (client-safe, no server imports).
 *
 * Defaults are Supabase Pro / Vercel Pro / Stripe Billing LIST prices as published in 2026.
 * They are editable from /platform/economics/costs and stored in
 * platform_economics_settings.pricing. Always reconcile against the real invoices.
 *
 * Two kinds of numbers live here:
 *   - marginal unit rates ($/GB, $/render, % fee): what one more GB / download costs once the
 *     platform is past its plan's included quota. Customer-level estimates use these.
 *   - platform-level included quotas and fixed fees: applied ONCE to the whole platform,
 *     never per customer (a Pro project gets one 100 GB storage allowance, not one per tenant).
 */

export const GB = 1024 ** 3;

export type CostAssumptions = {
  /** Supabase Storage, $ per GB-month beyond the included quota. */
  storagePerGbMonth: number;
  /** Supabase Storage GB included with the plan (platform-wide). */
  storageIncludedGb: number;
  /** Supabase uncached egress, $ per GB beyond the included quota. */
  uncachedEgressPerGb: number;
  uncachedEgressIncludedGb: number;
  /** Supabase cached (CDN hit) egress, $ per GB beyond the included quota. */
  cachedEgressPerGb: number;
  cachedEgressIncludedGb: number;
  /** Share (0–1) of direct signed-URL delivery assumed served from the Supabase CDN cache. */
  signedDeliveryCachedShare: number;
  /** Supabase image transformations, $ per 1,000 origin images beyond the included quota. */
  imageTransformsPer1000: number;
  imageTransformsIncluded: number;
  /** Vercel data transfer for bytes streamed through ShootPortal routes, $ per GB. */
  vercelTransferPerGb: number;
  vercelTransferIncludedGb: number;
  /** Stripe card processing on ShootPortal subscription invoices. */
  stripePercent: number;
  stripeFixedCents: number;
  /** Stripe Billing fee (% of recurring billing volume). */
  stripeBillingPercent: number;
  /** Fixed monthly platform costs (shared; never attributed per customer by default). */
  supabaseBaseMonthly: number;
  supabaseComputeMonthly: number;
  vercelBaseMonthly: number;
  otherFixedMonthly: number;
  /** When the defaults were last checked against provider pricing pages. */
  pricesVerifiedOn: string;
};

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  storagePerGbMonth: 0.021,
  storageIncludedGb: 100,
  uncachedEgressPerGb: 0.09,
  uncachedEgressIncludedGb: 250,
  cachedEgressPerGb: 0.03,
  cachedEgressIncludedGb: 250,
  signedDeliveryCachedShare: 0,
  imageTransformsPer1000: 5,
  imageTransformsIncluded: 100,
  vercelTransferPerGb: 0.15,
  vercelTransferIncludedGb: 1000,
  stripePercent: 0.029,
  stripeFixedCents: 30,
  stripeBillingPercent: 0.007,
  supabaseBaseMonthly: 25,
  supabaseComputeMonthly: 0,
  vercelBaseMonthly: 20,
  otherFixedMonthly: 0,
  pricesVerifiedOn: "2026-11-06",
};

export type AssumptionField = {
  key: Exclude<keyof CostAssumptions, "pricesVerifiedOn">;
  label: string;
  unit: string;
  group: "storage" | "egress" | "other" | "stripe" | "fixed";
  help: string;
  step: number;
  /** Stored as a 0–1 fraction, shown as a percentage. */
  percent?: boolean;
};

export const ASSUMPTION_FIELDS: AssumptionField[] = [
  { key: "storagePerGbMonth", label: "Storage rate", unit: "$/GB-month", group: "storage", step: 0.001, help: "Supabase Storage overage price per GB stored for a month." },
  { key: "storageIncludedGb", label: "Storage included", unit: "GB (platform)", group: "storage", step: 1, help: "GB included with the Supabase plan. Applied once to the whole platform." },
  { key: "uncachedEgressPerGb", label: "Uncached egress", unit: "$/GB", group: "egress", step: 0.001, help: "Supabase egress for bytes served from origin (server downloads, CDN misses)." },
  { key: "uncachedEgressIncludedGb", label: "Uncached included", unit: "GB (platform)", group: "egress", step: 1, help: "Uncached egress included per billing cycle, platform-wide." },
  { key: "cachedEgressPerGb", label: "Cached egress", unit: "$/GB", group: "egress", step: 0.001, help: "Supabase egress for CDN cache hits." },
  { key: "cachedEgressIncludedGb", label: "Cached included", unit: "GB (platform)", group: "egress", step: 1, help: "Cached egress included per billing cycle, platform-wide." },
  { key: "signedDeliveryCachedShare", label: "Direct delivery cache-hit share", unit: "%", group: "egress", step: 1, percent: true, help: "Share of signed-URL (browser-direct) bytes assumed to be CDN hits. 0% is the conservative default: every byte is billed as uncached." },
  { key: "vercelTransferPerGb", label: "Vercel transfer", unit: "$/GB", group: "egress", step: 0.01, help: "Bytes streamed through ShootPortal routes (single-file downloads, ZIPs) leave Vercel too, so they are billed twice: once by Supabase, once by Vercel." },
  { key: "vercelTransferIncludedGb", label: "Vercel transfer included", unit: "GB (platform)", group: "egress", step: 1, help: "Data transfer included with the Vercel plan." },
  { key: "imageTransformsPer1000", label: "Image transformations", unit: "$/1,000 images", group: "other", step: 0.1, help: "Supabase image transformation overage. We count renders we request (MLS downloads), which overstates billing — Supabase bills unique origin images per month." },
  { key: "imageTransformsIncluded", label: "Transformations included", unit: "images (platform)", group: "other", step: 1, help: "Origin images included per month, platform-wide." },
  { key: "stripePercent", label: "Card processing", unit: "%", group: "stripe", step: 0.01, percent: true, help: "Stripe card fee on each ShootPortal subscription invoice." },
  { key: "stripeFixedCents", label: "Card fixed fee", unit: "¢ / invoice", group: "stripe", step: 1, help: "Stripe per-charge fixed fee." },
  { key: "stripeBillingPercent", label: "Stripe Billing", unit: "%", group: "stripe", step: 0.01, percent: true, help: "Stripe Billing fee on recurring volume." },
  { key: "supabaseBaseMonthly", label: "Supabase plan", unit: "$/month", group: "fixed", step: 1, help: "Plan subscription (fixed, shared)." },
  { key: "supabaseComputeMonthly", label: "Supabase compute (net of credits)", unit: "$/month", group: "fixed", step: 1, help: "Database compute after the plan's compute credit (fixed, shared)." },
  { key: "vercelBaseMonthly", label: "Vercel plan", unit: "$/month", group: "fixed", step: 1, help: "Vercel seats / plan (fixed, shared)." },
  { key: "otherFixedMonthly", label: "Other fixed", unit: "$/month", group: "fixed", step: 1, help: "Email, domains, monitoring, etc. (fixed, shared)." },
];

/** Merge stored JSON over the defaults, dropping anything non-numeric or negative. */
export function parseCostAssumptions(raw: unknown): CostAssumptions {
  const out: CostAssumptions = { ...DEFAULT_COST_ASSUMPTIONS };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const field of ASSUMPTION_FIELDS) {
    const v = obj[field.key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[field.key] = field.percent ? Math.min(v, 1) : v;
    }
  }
  if (typeof obj.pricesVerifiedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.pricesVerifiedOn)) {
    out.pricesVerifiedOn = obj.pricesVerifiedOn;
  }
  return out;
}

export function fixedMonthlyTotal(a: CostAssumptions): number {
  return a.supabaseBaseMonthly + a.supabaseComputeMonthly + a.vercelBaseMonthly + a.otherFixedMonthly;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function bytesToGb(bytes: number): number {
  return bytes / GB;
}

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const abs = Math.abs(bytes);
  if (abs >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(digits)} TB`;
  if (abs >= GB) return `${(bytes / GB).toFixed(abs >= 100 * GB ? 0 : digits)} GB`;
  if (abs >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (abs >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${Math.round(bytes)} B`;
}

export function formatGb(gb: number | null | undefined, digits = 1): string {
  if (gb == null || !Number.isFinite(gb)) return "—";
  if (Math.abs(gb) >= 1024) return `${(gb / 1024).toFixed(gb >= 10 * 1024 ? 1 : 2)} TB`;
  return `${gb.toFixed(gb >= 100 ? 0 : digits)} GB`;
}

/** Dollars (not cents) → "$5.42". Small values keep cents; large values drop them. */
export function formatUsd(dollars: number | null | undefined, opts?: { cents?: boolean }): string {
  if (dollars == null || !Number.isFinite(dollars)) return "—";
  const keepCents = opts?.cents ?? Math.abs(dollars) < 1000;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: keepCents ? 2 : 0,
    maximumFractionDigits: keepCents ? 2 : 0,
  });
}

export function formatPct(fraction: number | null | undefined, digits = 0): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}
