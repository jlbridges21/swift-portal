import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ENTITLEMENT_LABELS,
  type EnforcedEntitlement,
  type EntitlementKey,
  type PlanLimits,
  type PlanRow,
} from "@/lib/plan-catalog";

export type {
  EnforcedEntitlement,
  EntitlementKey,
  FutureEntitlement,
  PlanLimits,
  PlanRow,
} from "@/lib/plan-catalog";
export {
  ENFORCED_ENTITLEMENTS,
  FUTURE_ENTITLEMENTS,
  ENTITLEMENT_LABELS,
  formatPlanPrice,
  isEnforcedEntitlement,
  isFutureEntitlement,
} from "@/lib/plan-catalog";

export class EntitlementError extends Error {
  entitlement: EntitlementKey;
  status = 403;

  constructor(entitlement: EntitlementKey, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.entitlement = entitlement;
  }
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asLimitInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function parseLimits(raw: Record<string, unknown> | null | undefined): PlanLimits {
  return {
    admin_seats: asLimitInt(raw?.admin_seats),
    storage_gb: asLimitInt(raw?.storage_gb),
    projects_per_month: asLimitInt(raw?.projects_per_month),
  };
}

async function loadPlanByKey(key: string): Promise<PlanRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, entitlements, limits, display_order, is_active, is_public, created_at, updated_at"
    )
    .eq("key", key)
    .maybeSingle();
  return (data as PlanRow | null) ?? null;
}

/** Fail closed for a plan key that is not yet attached to a business. */
export async function planGrantsEntitlement(
  planKey: string,
  key: EntitlementKey
): Promise<boolean> {
  const plan = await loadPlanByKey(planKey.trim());
  if (!plan || !plan.is_active) return false;
  return asBool(plan.entitlements?.[key]);
}

export async function assertActivePlanKey(planKey: string): Promise<PlanRow> {
  const key = planKey.trim();
  const plan = await loadPlanByKey(key);
  if (!plan) throw new Error(`Unknown plan “${key}”.`);
  if (!plan.is_active) throw new Error(`Plan “${plan.name}” is inactive.`);
  return plan;
}

/**
 * Fail closed: unknown plan key or inactive plan → null (no entitlements).
 */
export const getBusinessPlan = cache(async (businessId: string): Promise<PlanRow | null> => {
  if (!businessId) return null;
  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("plan")
    .eq("id", businessId)
    .maybeSingle();
  const planKey = typeof business?.plan === "string" ? business.plan.trim() : "";
  if (!planKey) return null;

  const plan = await loadPlanByKey(planKey);
  if (!plan || !plan.is_active) return null;
  return plan;
});

export const hasEntitlement = cache(
  async (businessId: string, key: EntitlementKey): Promise<boolean> => {
    const plan = await getBusinessPlan(businessId);
    if (!plan) return false;
    return asBool(plan.entitlements?.[key]);
  }
);

export const getPlanLimits = cache(async (businessId: string): Promise<PlanLimits> => {
  const plan = await getBusinessPlan(businessId);
  if (!plan) {
    return { admin_seats: 0, storage_gb: 0, projects_per_month: 0 };
  }
  return parseLimits(plan.limits as Record<string, unknown>);
});

export async function listActivePlans(): Promise<PlanRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, entitlements, limits, display_order, is_active, is_public, created_at, updated_at"
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as PlanRow[]) ?? [];
}

export async function listAllPlans(): Promise<PlanRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, entitlements, limits, display_order, is_active, is_public, created_at, updated_at"
    )
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as PlanRow[]) ?? [];
}

/** Cheapest active public plan that grants the entitlement, for error copy. */
async function planHintForEntitlement(key: EntitlementKey): Promise<string> {
  const plans = await listActivePlans();
  const matching = plans
    .filter((p) => asBool(p.entitlements?.[key]))
    .sort((a, b) => (a.price_monthly_cents ?? 0) - (b.price_monthly_cents ?? 0));
  if (matching[0]) return matching[0].name;
  return "a higher";
}

export async function requireEntitlement(
  businessId: string,
  key: EnforcedEntitlement
): Promise<void> {
  if (await hasEntitlement(businessId, key)) return;
  const label = ENTITLEMENT_LABELS[key];
  const hint = await planHintForEntitlement(key);
  throw new EntitlementError(
    key,
    `${label} is not included on this business’s plan. Upgrade to ${hint} (or another plan that includes ${label.toLowerCase()}).`
  );
}

const BRANDING_FIELDS = [
  "logoUrl",
  "emailLogoUrl",
  "faviconUrl",
  "brandPrimaryColor",
  "brandAccentColor",
] as const;

export function brandingFieldsChanged(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): boolean {
  for (const field of BRANDING_FIELDS) {
    if ((before?.[field] ?? "") !== (after?.[field] ?? "")) return true;
  }
  return false;
}
