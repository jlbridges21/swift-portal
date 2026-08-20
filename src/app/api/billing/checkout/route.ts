import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionState } from "@/lib/subscription";
import {
  billingMetadata,
  ensureStripeCustomer,
  loadBillingBusiness,
  loadPlanByKeyForBilling,
  type BillingInterval,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const body = (await request.json().catch(() => ({}))) as {
      planKey?: string;
      interval?: BillingInterval;
    };

    const planKey = typeof body.planKey === "string" ? body.planKey.trim() : "";
    const interval: BillingInterval = body.interval === "annual" ? "annual" : "monthly";

    if (!planKey) {
      return NextResponse.json({ error: "planKey is required." }, { status: 400 });
    }

    const business = await loadBillingBusiness(tenant.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const sub = getSubscriptionState(business);
    if (sub.isComped) {
      return NextResponse.json(
        { error: "Complimentary accounts do not need a subscription." },
        { status: 400 }
      );
    }

    if (planKey === "founding") {
      return NextResponse.json(
        { error: "The founding plan is not available via self-serve checkout." },
        { status: 400 }
      );
    }

    const plan = await loadPlanByKeyForBilling(planKey);
    if (!plan || !plan.is_active || !plan.is_public) {
      return NextResponse.json({ error: "Plan is not available." }, { status: 400 });
    }

    const priceId =
      interval === "annual" ? plan.stripe_price_annual_id : plan.stripe_price_monthly_id;
    if (!priceId) {
      return NextResponse.json(
        { error: "This plan is not configured for Stripe Checkout yet." },
        { status: 400 }
      );
    }

    const origin = getBusinessPortalOrigin(tenant.business);
    if (!origin) {
      return NextResponse.json({ error: "Portal URL not configured." }, { status: 500 });
    }

    const customerId = await ensureStripeCustomer(business, profile.email);

    const meta = billingMetadata(business.id);
    const subscriptionData: {
      metadata: Record<string, string>;
      trial_end?: number;
    } = { metadata: meta };

    // Trial handoff: keep remaining trial so mid-trial subscribe does not charge early.
    if (
      business.subscription_status === "trialing" &&
      business.trial_ends_at &&
      Number.isFinite(new Date(business.trial_ends_at).getTime())
    ) {
      const trialEndSec = Math.floor(new Date(business.trial_ends_at).getTime() / 1000);
      const nowSec = Math.floor(Date.now() / 1000);
      if (trialEndSec > nowSec + 60) {
        subscriptionData.trial_end = trialEndSec;
      }
    }

    const { stripe } = getStripe();
    // Platform account only — never pass stripeAccount / requestOptions.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: meta,
      subscription_data: subscriptionData,
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      client_reference_id: business.id,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
