import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { PlanRow } from "@/lib/plan-catalog";
import {
  ENFORCED_ENTITLEMENTS,
  FUTURE_ENTITLEMENTS,
  type EntitlementKey,
} from "@/lib/plan-catalog";

export type PlanWriteInput = {
  key?: string;
  name?: string;
  description?: string | null;
  price_monthly_cents?: number | null;
  price_annual_cents?: number | null;
  entitlements?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  display_order?: number;
  is_active?: boolean;
  is_public?: boolean;
};

const PLAN_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;

function normalizeEntitlements(raw: Record<string, unknown> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of [...ENFORCED_ENTITLEMENTS, ...FUTURE_ENTITLEMENTS] as EntitlementKey[]) {
    out[key] = raw?.[key] === true;
  }
  return out;
}

function normalizeLimits(raw: Record<string, unknown> | undefined): Record<string, number | null> {
  const intOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  return {
    admin_seats: intOrNull(raw?.admin_seats) ?? 0,
    storage_gb: intOrNull(raw?.storage_gb) ?? 0,
    projects_per_month: intOrNull(raw?.projects_per_month),
  };
}

export async function createPlan(
  input: PlanWriteInput,
  actor: { id: string; email: string | null }
): Promise<PlanRow> {
  const key = (input.key ?? "").trim().toLowerCase();
  if (!PLAN_KEY_RE.test(key)) {
    throw new Error("Plan key must be lowercase letters, numbers, and underscores (e.g. studio).");
  }
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Plan name is required.");

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("plans")
    .insert({
      key,
      name,
      description: input.description?.trim() || null,
      price_monthly_cents: input.price_monthly_cents ?? null,
      price_annual_cents: input.price_annual_cents ?? null,
      entitlements: normalizeEntitlements(input.entitlements),
      limits: normalizeLimits(input.limits),
      display_order: input.display_order ?? 100,
      is_active: input.is_active !== false,
      is_public: input.is_public !== false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create plan.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "plan.create",
    targetType: "plan",
    targetId: data.id,
    metadata: { key: data.key, name: data.name },
  });
  return data as PlanRow;
}

export async function updatePlan(
  id: string,
  input: PlanWriteInput,
  actor: { id: string; email: string | null }
): Promise<PlanRow> {
  const raw = await createServiceClient();
  const { data: existing } = await raw.from("plans").select("*").eq("id", id).maybeSingle();
  if (!existing) throw new Error("Plan not found.");

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Plan name is required.");
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.price_monthly_cents !== undefined) patch.price_monthly_cents = input.price_monthly_cents;
  if (input.price_annual_cents !== undefined) patch.price_annual_cents = input.price_annual_cents;
  if (input.entitlements !== undefined) patch.entitlements = normalizeEntitlements(input.entitlements);
  if (input.limits !== undefined) patch.limits = normalizeLimits(input.limits);
  if (input.display_order !== undefined) patch.display_order = Number(input.display_order);
  if (input.is_active !== undefined) patch.is_active = Boolean(input.is_active);
  if (input.is_public !== undefined) patch.is_public = Boolean(input.is_public);

  // Key changes are rejected — businesses.plan FK depends on stable keys.
  if (input.key !== undefined && input.key.trim() !== existing.key) {
    throw new Error("Plan key cannot be changed after creation.");
  }

  const { data, error } = await raw.from("plans").update(patch).eq("id", id).select("*").single();
  if (error || !data) throw new Error(error?.message || "Failed to update plan.");

  const activated =
    existing.is_active !== data.is_active
      ? data.is_active
        ? "plan.activate"
        : "plan.deactivate"
      : "plan.update";

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: activated,
    targetType: "plan",
    targetId: id,
    metadata: { key: data.key, patch },
  });
  return data as PlanRow;
}

export async function reorderPlans(
  orderedIds: string[],
  actor: { id: string; email: string | null }
): Promise<void> {
  const raw = await createServiceClient();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await raw
      .from("plans")
      .update({ display_order: (i + 1) * 10 })
      .eq("id", orderedIds[i]);
    if (error) throw new Error(error.message);
  }
  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "plan.reorder",
    targetType: "plan",
    metadata: { orderedIds },
  });
}
