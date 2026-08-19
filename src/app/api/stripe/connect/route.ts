import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  createConnectAccountLink,
  createStandardConnectedAccount,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
  stripeDashboardUrl,
  upsertPendingConnectedAccount,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function GET() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const isPlatform = isPlatformStripeBusiness(tenant.businessId);
    const integration = await loadBusinessStripeIntegration(tenant.businessId);

    return NextResponse.json({
      isPlatform,
      status: isPlatform ? "active" : integration?.stripe_account_status ?? "not_connected",
      chargesEnabled: isPlatform ? true : Boolean(integration?.stripe_charges_enabled),
      payoutsEnabled: isPlatform ? true : Boolean(integration?.stripe_payouts_enabled),
      connectedAt: integration?.stripe_connected_at ?? null,
      hasAccount: Boolean(integration?.stripe_account_id),
      dashboardUrl: stripeDashboardUrl(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    if (isPlatformStripeBusiness(tenant.businessId)) {
      return NextResponse.json(
        {
          error:
            "This business uses the platform Stripe account and cannot be onboarded as a connected account.",
        },
        { status: 400 }
      );
    }

    let integration = await loadBusinessStripeIntegration(tenant.businessId);
    let stripeAccountId = integration?.stripe_account_id ?? null;

    if (!stripeAccountId) {
      const account = await createStandardConnectedAccount();
      stripeAccountId = account.id;
      await upsertPendingConnectedAccount(tenant.businessId, stripeAccountId);
    }

    const url = await createConnectAccountLink(stripeAccountId, appUrl());
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe-connect] failed to start onboarding", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Could not start Stripe onboarding." }, { status: 500 });
  }
}
