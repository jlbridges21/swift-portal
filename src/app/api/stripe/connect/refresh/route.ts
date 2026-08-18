import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  createConnectAccountLink,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

function settingsRedirect(query: string): NextResponse {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return NextResponse.redirect(`${appUrl}/admin/settings?${query}`);
}

/**
 * Stripe Account Link refresh_url: regenerate a single-use link and send the
 * user back into hosted onboarding. Never log the URL.
 */
export async function GET() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    if (isPlatformStripeBusiness(tenant.businessId)) {
      return settingsRedirect("stripe=platform");
    }

    const integration = await loadBusinessStripeIntegration(tenant.businessId);
    if (!integration?.stripe_account_id) {
      return settingsRedirect("stripe=error");
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const url = await createConnectAccountLink(integration.stripe_account_id, appUrl);
    return NextResponse.redirect(url);
  } catch {
    return settingsRedirect("stripe=error");
  }
}
