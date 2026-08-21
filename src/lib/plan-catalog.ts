/** Client-safe plan catalog constants (no server imports). */

export const ENFORCED_ENTITLEMENTS = [
  "custom_branding",
  "custom_services",
  "custom_domain",
] as const;

export type EnforcedEntitlement = (typeof ENFORCED_ENTITLEMENTS)[number];

export const FUTURE_ENTITLEMENTS = [
  "custom_stages",
  "automations",
  "remove_platform_branding",
  "white_label",
  "advanced_reporting",
  "priority_support",
] as const;

export type FutureEntitlement = (typeof FUTURE_ENTITLEMENTS)[number];
export type EntitlementKey = EnforcedEntitlement | FutureEntitlement;

export const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  custom_branding: "Custom branding",
  custom_services: "Custom services",
  custom_domain: "Custom domain",
  custom_stages: "Custom stages",
  automations: "Automations",
  remove_platform_branding: "Remove platform branding",
  white_label: "White label",
  advanced_reporting: "Advanced reporting",
  priority_support: "Priority support",
};

export type PlanLimits = {
  admin_seats: number | null;
  storage_gb: number | null;
  projects_per_month: number | null;
};

export type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
  /** Free-trial days for NEW signups on this plan. 0 = no trial. */
  trial_days: number;
  entitlements: Record<string, unknown>;
  limits: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  stripe_product_id?: string | null;
  stripe_price_monthly_id?: string | null;
  stripe_price_annual_id?: string | null;
};

/** Fail-closed default when a plan row is missing or trial_days is invalid. */
export const FALLBACK_TRIAL_DAYS = 14;

/** Columns shared by plan catalog selects (keep in sync across entitlements). */
export const PLAN_CATALOG_SELECT =
  "id, key, name, description, price_monthly_cents, price_annual_cents, trial_days, entitlements, limits, display_order, is_active, is_public, created_at, updated_at, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id";

/**
 * Normalize trial_days from a plan row. Returns null when missing/invalid so
 * callers can log and fall back to FALLBACK_TRIAL_DAYS.
 */
export function parsePlanTrialDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  if (n < 0 || n > 365) return null;
  return n;
}

export function formatTrialDaysLabel(days: number): string {
  if (days <= 0) return "No free trial";
  return `${days}-day`;
}

export function isEnforcedEntitlement(key: string): key is EnforcedEntitlement {
  return (ENFORCED_ENTITLEMENTS as readonly string[]).includes(key);
}

export function isFutureEntitlement(key: string): key is FutureEntitlement {
  return (FUTURE_ENTITLEMENTS as readonly string[]).includes(key);
}

export function formatPlanPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
