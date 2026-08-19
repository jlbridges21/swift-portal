import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin, getDeploymentOrigin } from "@/lib/portal-url";
import {
  applyStripeAccountSnapshot,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
  retrieveConnectedAccount,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

function settingsRedirect(origin: string, query: string): NextResponse {
  return NextResponse.redirect(`${origin}/admin/settings?${query}`);
}

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

    const account = await retrieveConnectedAccount(integration.stripe_account_id);
    const updated = await applyStripeAccountSnapshot(tenant.businessId, account);
    const query = updated.stripe_account_status === "active" ? "stripe=connected" : "stripe=pending";
    return settingsRedirect(origin, query);
  } catch {
    return settingsRedirect(fallback, "stripe=error");
  }
}
