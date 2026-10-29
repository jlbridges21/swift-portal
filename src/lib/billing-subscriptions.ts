/**
 * ShootPortal SaaS subscription lifecycle helpers on the PLATFORM Stripe account
 * (never Connect — see stripe-billing.ts).
 *
 * - Duplicate protection: one live subscription per business.
 * - Early plan during a trial with < 48h left: Stripe Checkout cannot set trial_end that close,
 *   so we collect the card in Checkout `setup` mode and create the subscription here with
 *   trial_end = the stored businesses.trial_ends_at (never recalculated or extended).
 * - Server-side Checkout Session confirmation for the success page (webhook may be delayed).
 *   Confirmation always re-reads Stripe with the secret key; nothing from the browser is trusted
 *   beyond the session id, which must belong to the signed-in admin's business.
 */

import type Stripe from "stripe";
import { getStripe, getStripeMode } from "@/lib/stripe";
import {
  billingMetadata,
  customerIdForMode,
  isShootPortalBillingMetadata,
  LIVE_STRIPE_SUBSCRIPTION_STATUSES,
  loadBillingBusiness,
  subscriptionIdForMode,
  syncFromStripeSubscription,
  type BillingBusinessRow,
} from "@/lib/stripe-billing";
import { loadBillingJourney, recordConversionEvent, upsertBillingJourney } from "@/lib/billing-journey";
import { DAY_MS } from "@/lib/trial-conversion";
import type { SignupInterval } from "@/lib/signup-intent";

/** Metadata keys on setup-mode Checkout Sessions. */
export const SETUP_PRICE_META_KEY = "sp_schedule_price";
export const SETUP_COUPON_META_KEY = "sp_schedule_coupon";
export const SETUP_INTERVAL_META_KEY = "sp_schedule_interval";

/** Stripe Checkout rejects subscription_data.trial_end closer than 48h; keep a small buffer. */
export const CHECKOUT_MIN_TRIAL_LEAD_SECONDS = 2 * 24 * 60 * 60 + 60 * 60;

const CHECKOUT_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,240}$/;

function log(message: string, data: Record<string, unknown>) {
  console.info(`[billing-subscriptions] ${message}`, JSON.stringify(data));
}

function customerIdOf(obj: { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }): string | null {
  const c = obj.customer;
  if (typeof c === "string") return c;
  return c && "id" in c ? c.id : null;
}

export function intervalFromSubscription(sub: Stripe.Subscription): SignupInterval | null {
  const recurring = sub.items?.data?.[0]?.price?.recurring;
  if (!recurring) return null;
  if (recurring.interval === "year") return "annual";
  if (recurring.interval === "month") return "monthly";
  return null;
}

/**
 * How a trial user's plan is collected. Pure — used by checkout and tests.
 *  - "trial_end": Checkout subscription mode with subscription_data.trial_end (≥ 48h left)
 *  - "setup":     Checkout setup mode, subscription created server-side (< 48h left)
 *  - "none":      no trial left (new Subscribe Now accounts, expired trials) → charge now
 */
export function trialHandoffMode(
  business: Pick<BillingBusinessRow, "subscription_status" | "trial_ends_at">,
  nowMs = Date.now()
): { kind: "trial_end" | "setup" | "none"; trialEndUnix: number | null } {
  if (business.subscription_status !== "trialing" || !business.trial_ends_at) {
    return { kind: "none", trialEndUnix: null };
  }
  const endMs = new Date(business.trial_ends_at).getTime();
  if (!Number.isFinite(endMs)) return { kind: "none", trialEndUnix: null };
  const trialEndUnix = Math.floor(endMs / 1000);
  const nowSec = Math.floor(nowMs / 1000);
  // Within a minute of expiry there is nothing left to schedule.
  if (trialEndUnix <= nowSec + 60) return { kind: "none", trialEndUnix: null };
  if (trialEndUnix > nowSec + CHECKOUT_MIN_TRIAL_LEAD_SECONDS) return { kind: "trial_end", trialEndUnix };
  return { kind: "setup", trialEndUnix };
}

/**
 * The business's live (billing or about to bill) ShootPortal subscription, if any.
 * Checks the tracked id first, then the Stripe customer's subscriptions (covers a webhook
 * that has not landed yet).
 */
export async function findLiveBillingSubscription(
  business: BillingBusinessRow,
  options: { excludeSubscriptionId?: string } = {}
): Promise<Stripe.Subscription | null> {
  const { stripe } = getStripe();
  const mode = getStripeMode();
  const tracked = subscriptionIdForMode(business, mode);
  if (tracked && tracked !== options.excludeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(tracked);
      if (LIVE_STRIPE_SUBSCRIPTION_STATUSES.has(sub.status)) return sub;
    } catch (err) {
      log("tracked subscription lookup failed", {
        businessId: business.id,
        tracked,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const customerId = customerIdForMode(business, mode);
  if (!customerId) return null;
  try {
    const listed = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    return (
      listed.data
        .filter(
          (s) =>
            s.id !== options.excludeSubscriptionId &&
            LIVE_STRIPE_SUBSCRIPTION_STATUSES.has(s.status) &&
            isShootPortalBillingMetadata(s.metadata) &&
            s.metadata.business_id === business.id
        )
        .sort((a, b) => a.created - b.created)[0] ?? null
    );
  } catch (err) {
    log("customer subscription list failed", {
      businessId: business.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Two Checkout tabs completed (or a retry raced): keep the OLDER live subscription, cancel the
 * newer one immediately and refund what it charged. Returns true when `incoming` was the duplicate.
 */
export async function cancelIfDuplicateSubscription(
  incoming: Stripe.Subscription,
  business: BillingBusinessRow
): Promise<boolean> {
  if (!LIVE_STRIPE_SUBSCRIPTION_STATUSES.has(incoming.status)) return false;
  const other = await findLiveBillingSubscription(business, { excludeSubscriptionId: incoming.id });
  if (!other || other.created > incoming.created) return false;

  const { stripe } = getStripe();
  console.error("[billing-subscriptions] ALERT duplicate ShootPortal subscription — canceling newer", {
    businessId: business.id,
    keptSubscriptionId: other.id,
    canceledSubscriptionId: incoming.id,
  });
  await stripe.subscriptions.cancel(incoming.id, { prorate: false });
  // Point the business at the kept plan so the duplicate's "deleted" event is ignored as stale.
  await syncFromStripeSubscription(other, "duplicate_kept");

  const invoiceId =
    typeof incoming.latest_invoice === "string" ? incoming.latest_invoice : incoming.latest_invoice?.id ?? null;
  if (invoiceId) {
    try {
      const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 5 });
      for (const p of payments.data) {
        if (p.status !== "paid") continue;
        const pi = p.payment?.payment_intent;
        const piId = typeof pi === "string" ? pi : pi?.id ?? null;
        if (!piId) continue;
        const refund = await stripe.refunds.create(
          { payment_intent: piId, reason: "duplicate", metadata: billingMetadata(business.id) },
          { idempotencyKey: `sp-dup-sub-refund-${incoming.id}-${piId}` }
        );
        log("duplicate subscription refunded", { businessId: business.id, invoiceId, refundId: refund.id });
      }
    } catch (err) {
      console.error("[billing-subscriptions] ALERT duplicate refund FAILED — refund manually", {
        businessId: business.id,
        subscriptionId: incoming.id,
        invoiceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return true;
}

/**
 * Setup-mode Checkout completed → create the subscription billing at the stored trial end.
 * Idempotent: Stripe idempotency key per session + live-subscription check.
 */
export async function createSubscriptionFromSetupSession(
  session: Stripe.Checkout.Session,
  source: string
): Promise<{ ok: boolean; reason?: string; subscription?: Stripe.Subscription }> {
  if (session.mode !== "setup" || session.status !== "complete") return { ok: false, reason: "not_complete_setup" };
  if (!isShootPortalBillingMetadata(session.metadata)) return { ok: false, reason: "not_billing" };
  const businessId = session.metadata?.business_id ?? "";
  const priceId = session.metadata?.[SETUP_PRICE_META_KEY] ?? "";
  if (!businessId || !priceId) return { ok: false, reason: "missing_metadata" };

  const business = await loadBillingBusiness(businessId);
  if (!business) return { ok: false, reason: "business_not_found" };
  const customerId = customerIdOf(session);
  if (!customerId || customerIdForMode(business) !== customerId) {
    console.error("[billing-subscriptions] setup session customer mismatch", { businessId, sessionId: session.id });
    return { ok: false, reason: "customer_mismatch" };
  }

  const existing = await findLiveBillingSubscription(business);
  if (existing) {
    await syncFromStripeSubscription(existing, `${source}:existing`);
    return { ok: true, reason: "already_subscribed", subscription: existing };
  }

  const { stripe } = getStripe();
  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id ?? null;
  if (!setupIntentId) return { ok: false, reason: "missing_setup_intent" };
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethod =
    typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id ?? null;
  if (setupIntent.status !== "succeeded" || !paymentMethod) return { ok: false, reason: "setup_not_succeeded" };

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod } });

  // Precise stored trial end — if it has already passed, billing starts now.
  const handoff = trialHandoffMode(business);
  const coupon = session.metadata?.[SETUP_COUPON_META_KEY] || null;
  const params: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId, quantity: 1 }],
    default_payment_method: paymentMethod,
    metadata: { ...billingMetadata(business.id), sp_checkout_session: session.id },
    ...(handoff.trialEndUnix ? { trial_end: handoff.trialEndUnix } : { payment_behavior: "error_if_incomplete" }),
    ...(coupon ? { discounts: [{ coupon }] } : {}),
  };
  const subscription = await stripe.subscriptions.create(params, {
    idempotencyKey: `sp-setup-sub-${session.id}`,
  });
  log("subscription created from setup session", {
    businessId,
    sessionId: session.id,
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: handoff.trialEndUnix,
  });
  await syncFromStripeSubscription(subscription, source);
  return { ok: true, subscription };
}

export type CheckoutConfirmation =
  | { state: "activated" | "scheduled"; interval: SignupInterval | null; firstPaymentAt: string | null }
  | { state: "processing" | "not_complete" | "invalid" };

/** Success page: verify the session with Stripe and sync now (webhook may arrive later). */
export async function confirmBillingCheckoutSession(
  sessionId: string,
  businessId: string
): Promise<CheckoutConfirmation> {
  if (!CHECKOUT_SESSION_ID_RE.test(sessionId)) return { state: "invalid" };
  const { stripe } = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { state: "invalid" };
  }
  if (!isShootPortalBillingMetadata(session.metadata) || session.metadata?.business_id !== businessId) {
    return { state: "invalid" };
  }
  if (session.status !== "complete") return { state: "not_complete" };

  let subscription: Stripe.Subscription | null = null;
  if (session.mode === "setup") {
    const created = await createSubscriptionFromSetupSession(session, "checkout_success_page");
    subscription = created.subscription ?? null;
  } else if (session.mode === "subscription") {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
    if (subId) {
      subscription = await stripe.subscriptions.retrieve(subId);
      const business = await loadBillingBusiness(businessId);
      if (business && (await cancelIfDuplicateSubscription(subscription, business))) {
        // Second checkout for an already-live plan: canceled + refunded; show the kept plan.
        subscription = await findLiveBillingSubscription(business);
      } else {
        await syncFromStripeSubscription(subscription, "checkout_success_page");
      }
    }
  }
  if (!subscription) return { state: "processing" };
  if (subscription.status === "trialing") {
    return {
      state: "scheduled",
      interval: intervalFromSubscription(subscription),
      firstPaymentAt: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    };
  }
  if (subscription.status === "active") {
    return { state: "activated", interval: intervalFromSubscription(subscription), firstPaymentAt: null };
  }
  return { state: "processing" };
}

/**
 * After a subscription snapshot is applied: store the display snapshot (interval, amount,
 * scheduled first payment) and record scheduled / immediate-activation conversion events.
 */
export async function recordSubscriptionJourney(
  sub: Stripe.Subscription,
  business: Pick<BillingBusinessRow, "id" | "trial_ends_at">
): Promise<void> {
  try {
    const interval = intervalFromSubscription(sub);
    const unitAmount = sub.items?.data?.[0]?.price?.unit_amount ?? null;
    const scheduledAt = sub.status === "trialing" && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
    await upsertBillingJourney(business.id, {
      stripe_subscription_status: sub.status,
      subscription_interval: interval,
      subscription_amount_cents: unitAmount,
      scheduled_first_payment_at: scheduledAt,
    });
    const journey = await loadBillingJourney(business.id);
    const base = {
      interval,
      signup_path: journey?.signup_path ?? null,
      source: journey?.signup_source ?? null,
      subscription_status: sub.status,
    };
    if (sub.status === "trialing") {
      const trialStart = journey?.trial_started_at ? new Date(journey.trial_started_at).getTime() : NaN;
      await recordConversionEvent({
        businessId: business.id,
        type: "trial_subscription_scheduled",
        dedupeKey: `trial_subscription_scheduled:${sub.id}`,
        properties: {
          ...base,
          first_payment_at: scheduledAt,
          trial_day: Number.isFinite(trialStart) ? Math.floor((Date.now() - trialStart) / DAY_MS) + 1 : null,
        },
      });
    } else if (sub.status === "active" && !business.trial_ends_at) {
      await recordConversionEvent({
        businessId: business.id,
        type: "immediate_subscription_activated",
        dedupeKey: `immediate_subscription_activated:${business.id}`,
        properties: base,
      });
    }
  } catch (err) {
    console.warn("[billing-subscriptions] journey snapshot skipped", err instanceof Error ? err.message : err);
  }
}

/** invoice.paid / invoice.payment_failed conversion events (deduped by invoice / business). */
export async function recordInvoiceConversion(input: {
  invoice: Stripe.Invoice;
  subscription: Stripe.Subscription;
  businessId: string;
  eventType: "invoice.paid" | "invoice.payment_failed";
  isFirstPaidInvoice: boolean;
}): Promise<void> {
  const { invoice, subscription, businessId } = input;
  if (!invoice.id) return;
  const interval = intervalFromSubscription(subscription);
  const journey = await loadBillingJourney(businessId);
  const props = {
    interval,
    signup_path: journey?.signup_path ?? null,
    source: journey?.signup_source ?? null,
    subscription_status: subscription.status,
    billing_reason: invoice.billing_reason ?? null,
  };
  if (input.eventType === "invoice.payment_failed") {
    await recordConversionEvent({
      businessId,
      type: "subscription_payment_failed",
      dedupeKey: `subscription_payment_failed:${invoice.id}`,
      properties: { ...props, amount_cents: invoice.amount_due ?? null },
    });
    return;
  }
  if ((invoice.amount_paid ?? 0) <= 0) return;
  await recordConversionEvent({
    businessId,
    type: "subscription_payment_succeeded",
    dedupeKey: `subscription_payment_succeeded:${invoice.id}`,
    properties: { ...props, amount_cents: invoice.amount_paid ?? null },
  });
  if (!input.isFirstPaidInvoice) return;
  const business = await loadBillingBusiness(businessId);
  if (business?.trial_ends_at) {
    const trialEnd = new Date(business.trial_ends_at).getTime();
    await recordConversionEvent({
      businessId,
      type: "trial_converted_to_paid",
      dedupeKey: `trial_converted_to_paid:${businessId}`,
      properties: {
        ...props,
        amount_cents: invoice.amount_paid ?? null,
        // scheduled during the trial vs. subscribed after the trial had already expired
        timing: subscription.trial_end ? "scheduled_during_trial" : Date.now() > trialEnd ? "after_expiry" : "during_trial",
      },
    });
  }
}

/** Exact first charge for a scheduled plan (discounts included) — display only. */
export async function previewScheduledChargeCents(subscriptionId: string | null): Promise<number | null> {
  if (!subscriptionId) return null;
  try {
    const { stripe } = getStripe();
    const preview = await stripe.invoices.createPreview({ subscription: subscriptionId });
    return typeof preview.amount_due === "number" ? preview.amount_due : null;
  } catch (err) {
    log("invoice preview failed (display falls back to list price)", {
      subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
