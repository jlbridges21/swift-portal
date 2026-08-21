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
import { needsOnboardingRedirect } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * After Stripe hosted onboarding:
 *   - Always apply a live Account snapshot to DB.
 *   - If the business still needs the wizard, return to /onboarding?stripe=…
 *     (middleware used to strip query and bounce settings→onboarding, so the
 *     wizard never saw a refresh signal).
 *   - Otherwise land on Settings like before.
 */
function postConnectRedirect(
  origin: string,
  query: string,
  toOnboarding: boolean
): NextResponse {
  const path = toOnboarding ? "/onboarding" : "/admin/settings";
  return NextResponse.redirect(`${origin}${path}?${query}`);
}

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

    const account = await retrieveConnectedAccount(integration.stripe_account_id);
    const updated = await applyStripeAccountSnapshot(tenant.businessId, account);
    const query = updated.stripe_account_status === "active" ? "stripe=connected" : "stripe=pending";
    return postConnectRedirect(origin, query, toOnboarding);
  } catch {
    return postConnectRedirect(fallback, "stripe=error", false);
  }
}
