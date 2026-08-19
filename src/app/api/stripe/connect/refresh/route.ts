import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin, getDeploymentOrigin } from "@/lib/portal-url";
import {
  createConnectAccountLink,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

function settingsRedirect(origin: string, query: string): NextResponse {
  return NextResponse.redirect(`${origin}/admin/settings?${query}`);
}

/**
 * Stripe Account Link refresh_url: regenerate a single-use link and send the
 * user back into hosted onboarding. Never log the URL.
 */
export async function GET() {
  const fallback = getDeploymentOrigin();
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const origin = getBusinessPortalOrigin(tenant.business);

    if (isPlatformStripeBusiness(tenant.businessId)) {
      return settingsRedirect(origin, "stripe=platform");
    }

    const integration = await loadBusinessStripeIntegration(tenant.businessId);
    if (!integration?.stripe_account_id) {
      return settingsRedirect(origin, "stripe=error");
    }

    const url = await createConnectAccountLink(integration.stripe_account_id, origin);
    return NextResponse.redirect(url);
  } catch {
    return settingsRedirect(fallback, "stripe=error");
  }
}
