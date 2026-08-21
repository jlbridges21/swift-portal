import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin, getDeploymentOrigin } from "@/lib/portal-url";
import {
  createConnectAccountLink,
  isPlatformStripeBusiness,
  loadBusinessStripeIntegration,
} from "@/lib/stripe-connect";
import { needsOnboardingRedirect } from "@/lib/onboarding";

export const runtime = "nodejs";

function postConnectRedirect(
  origin: string,
  query: string,
  toOnboarding: boolean
): NextResponse {
  const path = toOnboarding ? "/onboarding" : "/admin/settings";
  return NextResponse.redirect(`${origin}${path}?${query}`);
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
    const toOnboarding =
      profile.role === "admin" &&
      needsOnboardingRedirect({
        onboardingCompletedAt: tenant.business.onboarding_completed_at,
        onboardingState: tenant.business.onboarding_state,
        role: profile.role,
      });

    if (isPlatformStripeBusiness(tenant.businessId)) {
      return postConnectRedirect(origin, "stripe=platform", toOnboarding);
    }

    const integration = await loadBusinessStripeIntegration(tenant.businessId);
    if (!integration?.stripe_account_id) {
      return postConnectRedirect(origin, "stripe=error", toOnboarding);
    }

    const url = await createConnectAccountLink(integration.stripe_account_id, origin);
    return NextResponse.redirect(url);
  } catch {
    return postConnectRedirect(fallback, "stripe=error", false);
  }
}
