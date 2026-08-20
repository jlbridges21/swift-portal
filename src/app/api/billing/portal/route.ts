import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionState } from "@/lib/subscription";
import { ensureStripeCustomer, loadBillingBusiness } from "@/lib/stripe-billing";

export const runtime = "nodejs";

export async function POST() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const business = await loadBillingBusiness(tenant.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const sub = getSubscriptionState(business);
    if (sub.isComped) {
      return NextResponse.json(
        { error: "Complimentary accounts do not use the billing portal." },
        { status: 400 }
      );
    }

    const origin = getBusinessPortalOrigin(tenant.business);
    if (!origin) {
      return NextResponse.json({ error: "Portal URL not configured." }, { status: 500 });
    }

    // Recreates a mode-correct customer when a legacy id belongs to the other mode.
    const customerId = await ensureStripeCustomer(business, profile.email);

    const { stripe } = getStripe();
    // Platform account only — never pass stripeAccount.
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
