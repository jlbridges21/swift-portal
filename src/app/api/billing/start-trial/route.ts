import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";
import { recordConversionEvent, upsertBillingJourney } from "@/lib/billing-journey";
import { canStartDeferredTrial } from "@/lib/subscription";

export const runtime = "nodejs";

/**
 * "Not ready to pay? Start your free trial instead." — for accounts created through
 * Subscribe Now that never had a trial and never subscribed. One-time: the conditional update
 * only matches while trial_ends_at IS NULL, so a trial can never be restarted or extended.
 */
export async function POST() {
  try {
    const profile = await requireAdmin({ adminOnly: true });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    if (tenant.impersonating && !tenant.allowWrites) {
      return NextResponse.json({ error: "Read-only while impersonating." }, { status: 403 });
    }

    const db = await createServiceClient();
    const { data: biz, error } = await db
      .from("businesses")
      .select("id, plan, created_via, subscription_status, trial_ends_at, stripe_subscription_id, stripe_subscription_id_test, stripe_subscription_id_live")
      .eq("id", tenant.businessId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !biz) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!canStartDeferredTrial(biz)) {
      return NextResponse.json(
        { error: "A free trial isn't available for this account.", code: "trial_unavailable" },
        { status: 409 }
      );
    }

    const plan = await assertActivePlanKey(biz.plan || "studio");
    const trialDays = resolvePlanTrialDays(plan, "deferred_trial");
    if (trialDays <= 0) {
      return NextResponse.json({ error: "Free trials are not offered right now.", code: "trial_unavailable" }, { status: 409 });
    }
    const startedAt = new Date();
    const trialEndsAt = new Date(startedAt.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: updated, error: upErr } = await db
      .from("businesses")
      .update({ subscription_status: "trialing", trial_ends_at: trialEndsAt })
      .eq("id", biz.id)
      .eq("subscription_status", "trial_expired")
      .is("trial_ends_at", null)
      .select("id");
    if (upErr) throw new Error(upErr.message);
    if (!updated?.length) {
      return NextResponse.json({ error: "A free trial isn't available for this account.", code: "trial_unavailable" }, { status: 409 });
    }
    invalidateHostLookupCache();

    await upsertBillingJourney(biz.id, { trial_started_at: startedAt.toISOString() });
    await recordConversionEvent({
      businessId: biz.id,
      type: "free_trial_started",
      dedupeKey: `free_trial_started:${biz.id}`,
      properties: { signup_path: "subscribe", fallback: true, trial_days: trialDays },
    });

    return NextResponse.json({ ok: true, trialEndsAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    console.error("[billing/start-trial] failed", message);
    return NextResponse.json({ error: "Could not start your trial. Please try again." }, { status: 500 });
  }
}
