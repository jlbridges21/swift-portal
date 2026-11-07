import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getStripe, getStripeMode } from "@/lib/stripe";
import { loadBillingBusiness, syncFromStripeSubscription, type BillingBusinessRow } from "@/lib/stripe-billing";
import { findLiveBillingSubscription, intervalFromSubscription } from "@/lib/billing-subscriptions";
import {
  ensureIntroOfferCoupon,
  loadIntroOfferContext,
  subscriptionHasDiscount,
} from "@/lib/intro-offer-server";
import { INTRO_OFFER_META_KEY, introOfferMetaValue, introOfferTerms } from "@/lib/intro-offer";
import { recordConversionEvent } from "@/lib/billing-journey";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import { extractStripeErrorDetails, logStripeError } from "@/lib/stripe-errors";

export const runtime = "nodejs";

/**
 * Start a pre-existing plan now — for customers whose plan was scheduled to begin at the end of
 * their free trial (Stripe subscription `trialing`, created before Subscribe & Save).
 *
 * Nothing here runs unless the signed-in owner explicitly confirms. Deploying this changes no
 * subscription: a scheduled plan keeps its original first charge date and price until the
 * customer chooses this. The SAME subscription is updated (never canceled or duplicated):
 * trial_end = now, plus the intro coupon when eligible. `payment_behavior: error_if_incomplete`
 * means a declined card leaves the subscription exactly as it was.
 *
 * GET  → quote (what would be charged today, what it renews at)
 * POST → { confirm: true, expectedChargeCents } → charge today
 *
 * Concurrency: the Stripe idempotency key and the update parameters are fully determined by the
 * subscription's state (id, scheduled trial end, payment method, coupon). Two tabs or a
 * double-click therefore get ONE result from Stripe — a second update could otherwise re-attach a
 * one-time coupon to the renewal. A retry after the customer changes their card uses a new key.
 */

type Quote = {
  interval: "monthly" | "annual" | null;
  regularCents: number;
  chargeTodayCents: number;
  savingsCents: number;
  withIntro: boolean;
  /** Existing discount kept as-is (e.g. a partner referral discount). */
  keepsExistingDiscount: boolean;
  scheduledFirstPaymentAt: string | null;
};

async function loadScheduled(businessId: string): Promise<
  | { ok: true; business: BillingBusinessRow; subscription: Stripe.Subscription }
  | { ok: false; status: number; code: string; error: string }
> {
  const business = await loadBillingBusiness(businessId);
  if (!business) return { ok: false, status: 404, code: "not_found", error: "Business not found." };
  if (business.subscription_status === "comped") {
    return { ok: false, status: 409, code: "not_scheduled", error: "Complimentary accounts don't need a plan." };
  }
  const live = await findLiveBillingSubscription(business);
  if (!live) {
    return { ok: false, status: 409, code: "not_scheduled", error: "There's no scheduled plan to start." };
  }
  // Fresh read immediately before any decision.
  const subscription = await getStripe().stripe.subscriptions.retrieve(live.id);
  const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : 0;
  if (subscription.status !== "trialing" || trialEnd <= Date.now() + 60_000) {
    return {
      ok: false,
      status: 409,
      code: "already_started",
      error: "Your plan has already started. Refresh to see your current billing.",
    };
  }
  return { ok: true, business, subscription };
}

async function buildQuote(
  business: BillingBusinessRow,
  subscription: Stripe.Subscription
): Promise<{ quote: Quote; couponNeeded: string | null }> {
  const interval = intervalFromSubscription(subscription);
  const item = subscription.items.data[0];
  const regularCents = (item?.price?.unit_amount ?? 0) * (item?.quantity ?? 1);
  const scheduledFirstPaymentAt = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  const hasDiscount = subscriptionHasDiscount(subscription);
  const intro = await loadIntroOfferContext(business, {
    authoritative: true,
    liveSubscription: { status: subscription.status, hasDiscount },
  });
  const terms = intro.decision.eligible && interval ? introOfferTerms(interval) : null;
  if (terms) {
    const charge = Math.max(0, regularCents - terms.amountOffCents);
    return {
      quote: {
        interval,
        regularCents,
        chargeTodayCents: charge,
        savingsCents: (regularCents - charge) * terms.discountedInvoices,
        withIntro: true,
        keepsExistingDiscount: false,
        scheduledFirstPaymentAt,
      },
      couponNeeded: interval,
    };
  }
  // No intro (referred / existing discount): exact amount from Stripe with the current discounts.
  let charge = regularCents;
  try {
    const preview = await getStripe().stripe.invoices.createPreview({
      subscription: subscription.id,
      subscription_details: { trial_end: "now", proration_behavior: "none" },
    });
    if (typeof preview.amount_due === "number") charge = preview.amount_due;
  } catch (err) {
    logStripeError("billing/start-plan-now preview", err, { businessId: business.id });
  }
  return {
    quote: {
      interval,
      regularCents,
      chargeTodayCents: charge,
      savingsCents: 0,
      withIntro: false,
      keepsExistingDiscount: hasDiscount,
      scheduledFirstPaymentAt,
    },
    couponNeeded: null,
  };
}

/** Which card Stripe will charge — part of the idempotency key so a new card means a new attempt. */
async function paymentMethodKeyFor(subscription: Stripe.Subscription): Promise<string> {
  const own = subscription.default_payment_method;
  if (own) return typeof own === "string" ? own : own.id;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  try {
    const customer = await getStripe().stripe.customers.retrieve(customerId);
    if (!("deleted" in customer && customer.deleted)) {
      const pm = customer.invoice_settings?.default_payment_method;
      if (pm) return typeof pm === "string" ? pm : pm.id;
    }
  } catch {
    /* fall through */
  }
  return "nopm";
}

function authError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown";
  if (message === "Unauthorized" || message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
  return null;
}

export async function GET() {
  try {
    const profile = await requireAdmin({ adminOnly: true });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const loaded = await loadScheduled(tenant.businessId);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, code: loaded.code }, { status: loaded.status });
    const { quote } = await buildQuote(loaded.business, loaded.subscription);
    return NextResponse.json({ quote });
  } catch (err) {
    const auth = authError(err);
    if (auth) return auth;
    logStripeError("billing/start-plan-now GET", err, {});
    return NextResponse.json({ error: "Could not load your plan. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin({ adminOnly: true });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    // Only the business owner may authorize an earlier charge — never support impersonation.
    if (tenant.impersonating) {
      return NextResponse.json(
        { error: "Only the account owner can authorize a payment.", code: "owner_only" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirm?: unknown;
      expectedChargeCents?: unknown;
    };
    if (body.confirm !== true) {
      return NextResponse.json({ error: "Please confirm the payment to continue.", code: "confirmation_required" }, { status: 400 });
    }
    const expected = typeof body.expectedChargeCents === "number" ? Math.round(body.expectedChargeCents) : null;

    const loaded = await loadScheduled(tenant.businessId);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, code: loaded.code }, { status: loaded.status });
    const { business, subscription } = loaded;

    const { quote, couponNeeded } = await buildQuote(business, subscription);
    // The customer authorized a specific amount. If it changed (offer window closed, plan
    // changed in another tab), stop and show the new amount instead of charging it.
    if (expected == null || expected !== quote.chargeTodayCents) {
      return NextResponse.json(
        {
          error: "The amount due today has changed. Please review the updated price before confirming.",
          code: "amount_changed",
          quote,
        },
        { status: 409 }
      );
    }

    let couponId: string | null = null;
    if (couponNeeded) {
      couponId = await ensureIntroOfferCoupon(couponNeeded);
      if (!couponId) {
        return NextResponse.json(
          {
            error: "We couldn't apply your discount just now. Nothing was charged and your plan is unchanged — please try again shortly.",
            code: "offer_unavailable",
          },
          { status: 503 }
        );
      }
    }

    const { stripe } = getStripe();
    const paymentMethodKey = await paymentMethodKeyFor(subscription);
    let updated: Stripe.Subscription;
    try {
      updated = await stripe.subscriptions.update(
        subscription.id,
        {
          trial_end: "now",
          proration_behavior: "none",
          // Declined / needs authentication → 402 and the subscription is NOT changed.
          payment_behavior: "error_if_incomplete",
          ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
          // Deterministic values only (see Concurrency above).
          metadata: {
            sp_started_early: "true",
            sp_originally_scheduled_for: quote.scheduledFirstPaymentAt ?? "",
            ...(couponId && quote.interval ? { [INTRO_OFFER_META_KEY]: introOfferMetaValue(quote.interval) } : {}),
          },
        },
        {
          idempotencyKey: `sp-start-now-${subscription.id}-${subscription.trial_end}-${paymentMethodKey}-${couponId ?? "none"}`,
        }
      );
    } catch (err) {
      const d = extractStripeErrorDetails(err);
      logStripeError("billing/start-plan-now update", err, { businessId: business.id, mode: getStripeMode() });
      // A concurrent identical request (other tab) may have started it already.
      try {
        const now = await stripe.subscriptions.retrieve(subscription.id);
        if (now.status === "active") {
          await syncFromStripeSubscription(now, "start_plan_now:concurrent");
          invalidateHostLookupCache();
          return NextResponse.json({ ok: true, status: now.status, interval: quote.interval, chargedCents: quote.chargeTodayCents });
        }
      } catch {
        /* report the original error */
      }
      const declined = d?.type === "StripeCardError" || d?.code === "card_declined" || (d?.statusCode ?? 0) === 402;
      return NextResponse.json(
        {
          error: declined
            ? "Your card was declined, so nothing was charged. Your plan is unchanged and still starts on its original date. Update your card in Manage billing and try again."
            : "We couldn't start your plan. Nothing was charged and your plan is unchanged. Please try again.",
          code: declined ? "payment_failed" : "start_failed",
        },
        { status: declined ? 402 : 502 }
      );
    }

    await syncFromStripeSubscription(updated, "start_plan_now");
    invalidateHostLookupCache();
    await recordConversionEvent({
      businessId: business.id,
      type: "scheduled_plan_started_early",
      dedupeKey: `scheduled_plan_started_early:${subscription.id}`,
      properties: {
        interval: quote.interval,
        charge_cents: quote.chargeTodayCents,
        with_intro: quote.withIntro,
        days_before_scheduled:
          quote.scheduledFirstPaymentAt != null
            ? Math.round((new Date(quote.scheduledFirstPaymentAt).getTime() - Date.now()) / 86_400_000)
            : null,
      },
    });

    return NextResponse.json({ ok: true, status: updated.status, interval: quote.interval, chargedCents: quote.chargeTodayCents });
  } catch (err) {
    const auth = authError(err);
    if (auth) return auth;
    logStripeError("billing/start-plan-now POST", err, {});
    return NextResponse.json({ error: "We couldn't start your plan. Nothing was charged. Please try again." }, { status: 500 });
  }
}
