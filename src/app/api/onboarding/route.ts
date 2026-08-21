import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getOnboardingSnapshot, applyOnboardingAction } from "@/lib/onboarding-server";
import {
  canCompleteStep,
  canFinishOnboarding,
  isOnboardingStepId,
  ONBOARDING_STEP_IDS,
} from "@/lib/onboarding";
import type { OnboardingAction } from "@/lib/onboarding-server";
import { hasEntitlement } from "@/lib/entitlements";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  defaultHeadlineForBusiness,
  DEFAULT_HERO_SUBHEADLINE,
} from "@/lib/landing-content";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  try {
    const snap = await getOnboardingSnapshot(tenant.businessId);
    const canCustomize = await hasEntitlement(tenant.businessId, "custom_branding");
    const portalUrl = await getBusinessPortalOriginById(tenant.businessId);
    const identityGate = canCompleteStep("identity", {
      settings: snap.settings,
      services: snap.services,
    });
    const servicesGate = canCompleteStep("services", {
      settings: snap.settings,
      services: snap.services,
    });
    const finishGate = canFinishOnboarding({
      settings: snap.settings,
      services: snap.services,
    });

    return NextResponse.json({
      completedAt: snap.completedAt,
      state: snap.state,
      steps: ONBOARDING_STEP_IDS,
      canCustomizeBranding: canCustomize,
      portalUrl,
      business: {
        businessName: snap.settings.business.businessName,
        primaryContactEmail: snap.settings.business.primaryContactEmail,
        phoneNumber: snap.settings.business.phoneNumber,
        logoUrl: snap.settings.business.logoUrl,
        brandPrimaryColor: snap.settings.business.brandPrimaryColor,
        brandAccentColor: snap.settings.business.brandAccentColor,
      },
      landing: {
        headline: snap.settings.landing.hero.headline,
        subheadline: snap.settings.landing.hero.subheadline,
        headlinePlaceholder: defaultHeadlineForBusiness(
          snap.settings.business.businessName || tenant.business.name
        ),
        subheadlinePlaceholder: DEFAULT_HERO_SUBHEADLINE,
      },
      gates: {
        identity: identityGate,
        services: servicesGate,
        finish: finishGate,
      },
      serviceCount: snap.services.filter((s) => s.is_active !== false).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load onboarding" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  let body: { action?: string; step?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let action: OnboardingAction | null = null;
  switch (body.action) {
    case "goto":
      if (!isOnboardingStepId(body.step)) {
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
      }
      action = { type: "goto", step: body.step };
      break;
    case "complete":
      if (!isOnboardingStepId(body.step)) {
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
      }
      action = { type: "complete", step: body.step };
      break;
    case "skip":
      if (!isOnboardingStepId(body.step)) {
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
      }
      action = { type: "skip", step: body.step };
      break;
    case "defer":
      action = { type: "defer" };
      break;
    case "resume":
      action = { type: "resume" };
      break;
    case "finish":
      action = { type: "finish" };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const result = await applyOnboardingAction(tenant.businessId, action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Onboarding update failed" },
      { status: 400 }
    );
  }
}
