import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  applyStripeAccountSnapshot,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
  retrieveConnectedAccount,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

function settingsRedirect(query: string): NextResponse {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return NextResponse.redirect(`${appUrl}/admin/settings?${query}`);
}

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

    const account = await retrieveConnectedAccount(integration.stripe_account_id);
    const updated = await applyStripeAccountSnapshot(tenant.businessId, account);
    const query = updated.stripe_account_status === "active" ? "stripe=connected" : "stripe=pending";
    return settingsRedirect(query);
  } catch {
    return settingsRedirect("stripe=error");
  }
}
