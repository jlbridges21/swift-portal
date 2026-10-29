/**
 * Server-side signup path / scheduled plan / trial modal / conversion event storage
 * (migration v107). Platform-scoped tables keyed by business_id, service role only.
 *
 * Every function here is best-effort: before v107 runs (or on any DB error) reads return
 * null and writes are skipped. Billing and access never depend on these tables — the
 * businesses row + Stripe stay the source of truth.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe";
import type { SignupIntent, SignupInterval, SignupPath } from "@/lib/signup-intent";
import { isTrialMilestone, type TrialMilestone } from "@/lib/trial-conversion";

export type BillingJourneyRow = {
  business_id: string;
  signup_path: SignupPath | null;
  preferred_interval: SignupInterval | null;
  signup_source: string | null;
  trial_started_at: string | null;
  last_checkout_session_id: string | null;
  last_checkout_at: string | null;
  stripe_subscription_status: string | null;
  subscription_interval: SignupInterval | null;
  subscription_amount_cents: number | null;
  scheduled_first_payment_at: string | null;
};

export const CONVERSION_EVENT_TYPES = [
  "signup_path_selected",
  "free_trial_started",
  "immediate_checkout_started",
  "immediate_subscription_activated",
  "demo_checkout_started",
  "trial_modal_viewed",
  "trial_modal_dismissed",
  "trial_plan_selected",
  "trial_subscription_scheduled",
  "trial_converted_to_paid",
  "subscription_payment_succeeded",
  "subscription_payment_failed",
] as const;

export type ConversionEventType = (typeof CONVERSION_EVENT_TYPES)[number];

/** Only small, non-sensitive values. Never card, bank, email, or Stripe secrets. */
export type ConversionEventProperties = Record<string, string | number | boolean | null>;

const JOURNEY_SELECT =
  "business_id, signup_path, preferred_interval, signup_source, trial_started_at, last_checkout_session_id, last_checkout_at, stripe_subscription_status, subscription_interval, subscription_amount_cents, scheduled_first_payment_at";

function warn(where: string, err: unknown) {
  console.warn(`[billing-journey] ${where} skipped`, err instanceof Error ? err.message : err);
}

function currentMode(): "test" | "live" | null {
  try {
    return getStripeMode();
  } catch {
    return null;
  }
}

export async function loadBillingJourney(businessId: string): Promise<BillingJourneyRow | null> {
  try {
    const db = await createServiceClient();
    const { data, error } = await db
      .from("business_billing_journey")
      .select(JOURNEY_SELECT)
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) {
      warn("load", error.message);
      return null;
    }
    return (data as BillingJourneyRow | null) ?? null;
  } catch (err) {
    warn("load", err);
    return null;
  }
}

export async function upsertBillingJourney(
  businessId: string,
  patch: Partial<Omit<BillingJourneyRow, "business_id">>
): Promise<boolean> {
  try {
    const db = await createServiceClient();
    const { error } = await db
      .from("business_billing_journey")
      .upsert(
        { business_id: businessId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "business_id" }
      );
    if (error) {
      warn("upsert", error.message);
      return false;
    }
    return true;
  } catch (err) {
    warn("upsert", err);
    return false;
  }
}

/**
 * Append a conversion event once. `dedupeKey` makes webhook retries, redirects, refreshes and
 * re-renders idempotent (unique constraint + ignoreDuplicates).
 */
export async function recordConversionEvent(input: {
  businessId: string | null;
  type: ConversionEventType;
  dedupeKey: string;
  properties?: ConversionEventProperties;
  occurredAt?: Date;
}): Promise<void> {
  try {
    const db = await createServiceClient();
    const { error } = await db.from("billing_conversion_events").upsert(
      {
        business_id: input.businessId,
        event_type: input.type,
        dedupe_key: input.dedupeKey.slice(0, 200),
        properties: input.properties ?? {},
        stripe_mode: currentMode(),
        occurred_at: (input.occurredAt ?? new Date()).toISOString(),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    );
    if (error) warn(`event ${input.type}`, error.message);
  } catch (err) {
    warn(`event ${input.type}`, err);
  }
}

/** Milestones this admin already saw, or null when state is unavailable (no modal then). */
export async function loadSeenTrialMilestones(
  businessId: string,
  userId: string
): Promise<Set<TrialMilestone> | null> {
  try {
    const db = await createServiceClient();
    const { data, error } = await db
      .from("trial_modal_events")
      .select("milestone")
      .eq("business_id", businessId)
      .eq("user_id", userId);
    if (error) {
      warn("seen milestones", error.message);
      return null;
    }
    const seen = new Set<TrialMilestone>();
    for (const row of data ?? []) if (isTrialMilestone(row.milestone)) seen.add(row.milestone);
    return seen;
  } catch (err) {
    warn("seen milestones", err);
    return null;
  }
}

export type TrialModalAction = "viewed" | "dismissed" | "cta";

/** First write for a milestone wins the "viewed" row; later actions only fill their timestamp. */
export async function recordTrialModalAction(input: {
  businessId: string;
  userId: string;
  milestone: TrialMilestone;
  action: TrialModalAction;
}): Promise<{ firstView: boolean }> {
  const now = new Date().toISOString();
  try {
    const db = await createServiceClient();
    const { data: inserted, error: insErr } = await db
      .from("trial_modal_events")
      .upsert(
        { business_id: input.businessId, user_id: input.userId, milestone: input.milestone, viewed_at: now },
        { onConflict: "business_id,user_id,milestone", ignoreDuplicates: true }
      )
      .select("milestone");
    if (insErr) {
      warn("modal view", insErr.message);
      return { firstView: false };
    }
    const firstView = (inserted ?? []).length > 0;
    if (input.action !== "viewed") {
      const column = input.action === "dismissed" ? "dismissed_at" : "cta_at";
      const { error } = await db
        .from("trial_modal_events")
        .update({ [column]: now })
        .eq("business_id", input.businessId)
        .eq("user_id", input.userId)
        .eq("milestone", input.milestone)
        .is(column, null);
      if (error) warn("modal action", error.message);
    }
    return { firstView };
  } catch (err) {
    warn("modal action", err);
    return { firstView: false };
  }
}

/**
 * createBusinessForPlatform overrides for the chosen path. Subscribe Now accounts get NO trial
 * (trial_ends_at NULL, status trial_expired → paywall = checkout). Trial path keeps today's
 * defaults (plans.trial_days).
 */
export function signupProvisioningOverrides(
  intent: SignupIntent
): { subscriptionStatus?: "trial_expired"; trialEndsAt?: null } {
  return intent.path === "subscribe" ? { subscriptionStatus: "trial_expired", trialEndsAt: null } : {};
}

/** After a self-serve business is created: remember the path and record signup events. */
export async function recordSignupJourney(
  businessId: string,
  intent: SignupIntent,
  trialStartedAt: Date | null
): Promise<void> {
  await upsertBillingJourney(businessId, {
    signup_path: intent.path,
    preferred_interval: intent.interval,
    signup_source: intent.source,
    trial_started_at: trialStartedAt ? trialStartedAt.toISOString() : null,
  });
  const props = { signup_path: intent.path, interval: intent.interval, source: intent.source };
  await recordConversionEvent({
    businessId,
    type: "signup_path_selected",
    dedupeKey: `signup_path_selected:${businessId}`,
    properties: props,
  });
  if (trialStartedAt) {
    await recordConversionEvent({
      businessId,
      type: "free_trial_started",
      dedupeKey: `free_trial_started:${businessId}`,
      properties: props,
    });
  }
}

/** Admin layout: everything the banner + trial modal need, in parallel, never throwing. */
export async function loadTrialUiContext(
  businessId: string,
  userId: string | null,
  options: { needModalState: boolean }
): Promise<{
  journey: BillingJourneyRow | null;
  businessCreatedAt: string | null;
  seen: Set<TrialMilestone> | null;
}> {
  const createdAt = (async () => {
    if (!options.needModalState) return null;
    try {
      const db = await createServiceClient();
      const { data } = await db.from("businesses").select("created_at").eq("id", businessId).maybeSingle();
      return (data?.created_at as string | undefined) ?? null;
    } catch {
      return null;
    }
  })();
  const [journey, businessCreatedAt, seen] = await Promise.all([
    loadBillingJourney(businessId),
    createdAt,
    options.needModalState && userId ? loadSeenTrialMilestones(businessId, userId) : Promise.resolve(null),
  ]);
  return { journey, businessCreatedAt, seen };
}
