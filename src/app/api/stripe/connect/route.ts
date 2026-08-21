import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import {
  createConnectAccountLink,
  createStandardConnectedAccount,
  getLiveConnectStatus,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
  upsertPendingConnectedAccount,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const live = await getLiveConnectStatus(tenant.businessId);
    return NextResponse.json(live);
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

    const url = await createConnectAccountLink(
      stripeAccountId,
      getBusinessPortalOrigin(tenant.business)
    );
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe-connect] failed to start onboarding", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Could not start Stripe onboarding." }, { status: 500 });
  }
}
