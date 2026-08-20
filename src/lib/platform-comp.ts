/**
 * Platform grant / revoke of complimentary (comped) access.
 * Super-admin only — route handlers must use requireSuperAdminApi().
 */

import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import {
  SWIFT_COMP_PROTECTED_BUSINESS_ID,
  SWIFT_COMP_REVOKE_CONFIRM,
} from "@/lib/platform-session";
import { isSubscriptionStatus } from "@/lib/subscription";

export { SWIFT_COMP_PROTECTED_BUSINESS_ID, SWIFT_COMP_REVOKE_CONFIRM } from "@/lib/platform-session";

export type GrantCompedInput = {
  reason: string;
  /** null / omitted / empty = permanent */
  compedUntil?: string | null;
};

export type RevokeCompedInput = {
  /** Move to trialing (with trialEndsAt) or canceled. */
  nextStatus: "trialing" | "canceled";
  trialEndsAt?: string | null;
  /** Required when revoking Swift’s comp. */
  confirm?: string | null;
};

export async function grantCompedAccess(
  businessId: string,
  input: GrantCompedInput,
  actor: { id: string; email: string | null }
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to grant comped access.");

  let compedUntil: string | null = null;
  if (input.compedUntil != null && String(input.compedUntil).trim() !== "") {
    const parsed = new Date(input.compedUntil);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid comped_until.");
    if (parsed.getTime() <= Date.now()) {
      throw new Error("comped_until must be in the future (or leave empty for permanent).");
    }
    compedUntil = parsed.toISOString();
  }

  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select(
      "id, name, subscription_status, trial_ends_at, comped_until, comped_reason, comped_at, deleted_at"
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Cannot comp a deleted business.");

  const { data, error } = await raw
    .from("businesses")
    .update({
      subscription_status: "comped",
      comped_until: compedUntil,
      comped_reason: reason,
      comped_by: actor.id,
      comped_at: new Date().toISOString(),
    })
    .eq("id", businessId)
    .select(
      "id, name, subscription_status, trial_ends_at, comped_until, comped_reason, comped_by, comped_at"
    )
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to grant comped access.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.comp_grant",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: {
      reason,
      comped_until: compedUntil,
      permanent: compedUntil == null,
      previous: {
        subscription_status: existing.subscription_status,
        trial_ends_at: existing.trial_ends_at,
        comped_until: existing.comped_until,
        comped_reason: existing.comped_reason,
      },
    },
  });
  invalidateHostLookupCache();
  return data;
}

export async function revokeCompedAccess(
  businessId: string,
  input: RevokeCompedInput,
  actor: { id: string; email: string | null }
) {
  if (input.nextStatus !== "trialing" && input.nextStatus !== "canceled") {
    throw new Error("Revoke must move the business to trialing or canceled.");
  }

  if (businessId === SWIFT_COMP_PROTECTED_BUSINESS_ID) {
    if (input.confirm !== SWIFT_COMP_REVOKE_CONFIRM) {
      throw new Error(
        `Revoking the platform-owner business’s comp requires confirm: “${SWIFT_COMP_REVOKE_CONFIRM}”.`
      );
    }
  }

  let trialEndsAt: string | null = null;
  if (input.nextStatus === "trialing") {
    if (!input.trialEndsAt || String(input.trialEndsAt).trim() === "") {
      throw new Error("trialing requires a future trial_ends_at.");
    }
    const parsed = new Date(input.trialEndsAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid trial_ends_at.");
    if (parsed.getTime() <= Date.now()) {
      throw new Error("trial_ends_at must be in the future when revoking to trialing.");
    }
    trialEndsAt = parsed.toISOString();
  }

  if (!isSubscriptionStatus(input.nextStatus)) {
    throw new Error("Invalid next status.");
  }

  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select(
      "id, name, subscription_status, trial_ends_at, comped_until, comped_reason, deleted_at"
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Cannot revoke comp on a deleted business.");
  if (existing.subscription_status !== "comped") {
    throw new Error("This business is not currently comped.");
  }

  const { data, error } = await raw
    .from("businesses")
    .update({
      subscription_status: input.nextStatus,
      trial_ends_at: input.nextStatus === "trialing" ? trialEndsAt : null,
      comped_until: null,
      comped_reason: null,
      comped_by: null,
      comped_at: null,
    })
    .eq("id", businessId)
    .select(
      "id, name, subscription_status, trial_ends_at, comped_until, comped_reason, comped_by, comped_at"
    )
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to revoke comped access.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.comp_revoke",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: {
      next_status: input.nextStatus,
      trial_ends_at: trialEndsAt,
      previous: {
        subscription_status: existing.subscription_status,
        comped_until: existing.comped_until,
        comped_reason: existing.comped_reason,
        trial_ends_at: existing.trial_ends_at,
      },
      swift_protected: businessId === SWIFT_COMP_PROTECTED_BUSINESS_ID,
    },
  });
  invalidateHostLookupCache();
  return data;
}
