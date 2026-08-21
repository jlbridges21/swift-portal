import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { OnboardingWizard } from "@/components/admin/onboarding-wizard";
import { getOnboardingSnapshot, applyOnboardingAction } from "@/lib/onboarding-server";
import { hasEntitlement } from "@/lib/entitlements";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  canCompleteStep,
  canFinishOnboarding,
  ONBOARDING_STEP_IDS,
} from "@/lib/onboarding";
import {
  defaultHeadlineForBusiness,
  DEFAULT_HERO_SUBHEADLINE,
  DEFAULT_HOW_IT_WORKS,
} from "@/lib/landing-content";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { profile, tenant } = await requireAdminPage();

  if (tenant.impersonating) redirect("/admin");

  const snap = await getOnboardingSnapshot(tenant.businessId);
  if (snap.completedAt) redirect("/admin");

  if (snap.state.deferred) {
    await applyOnboardingAction(tenant.businessId, { type: "resume" });
    snap.state = { ...snap.state, deferred: false };
  }

  const settings = snap.settings;
  const brand = getPortalBrandFromSettings(settings);
  const canCustomize = await hasEntitlement(tenant.businessId, "custom_branding");
  const portalUrl = await getBusinessPortalOriginById(tenant.businessId);

  const initial = {
    completedAt: snap.completedAt,
    state: snap.state,
    canCustomizeBranding: canCustomize,
    portalUrl,
    business: {
      businessName: settings.business.businessName,
      primaryContactEmail: settings.business.primaryContactEmail,
      phoneNumber: settings.business.phoneNumber,
      logoUrl: settings.business.logoUrl,
      brandPrimaryColor: settings.business.brandPrimaryColor,
      brandAccentColor: settings.business.brandAccentColor,
    },
    landing: {
      headline: settings.landing.hero.headline,
      subheadline: settings.landing.hero.subheadline,
      headlinePlaceholder: defaultHeadlineForBusiness(
        settings.business.businessName || tenant.business.name
      ),
      subheadlinePlaceholder: DEFAULT_HERO_SUBHEADLINE,
      howItWorks: settings.landing.howItWorks,
      howItWorksPlaceholders: DEFAULT_HOW_IT_WORKS.map((s) => ({ ...s })),
    },
    gates: {
      identity: canCompleteStep("identity", {
        settings,
        services: snap.services,
      }),
      services: canCompleteStep("services", {
        settings,
        services: snap.services,
      }),
      finish: canFinishOnboarding({ settings, services: snap.services }),
    },
    serviceCount: snap.services.filter((s) => s.is_active !== false).length,
    steps: ONBOARDING_STEP_IDS,
  };

  return (
    <BrandProvider brand={brand}>
      <Suspense fallback={<div className="p-8 text-sm text-muted">Loading setup…</div>}>
        <OnboardingWizard
          initial={initial}
          businessDisplayName={tenant.business.name || profile.full_name || "Your studio"}
        />
      </Suspense>
    </BrandProvider>
  );
}
