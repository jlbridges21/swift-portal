import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { PlatformLanding } from "@/components/landing/platform-landing";
import { BrandProvider } from "@/components/brand/brand-provider";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { AuthFragmentHandler } from "@/components/auth/auth-fragment-handler";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { platformPortalBrand, publicHostBrand } from "@/lib/public-host-chrome";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";
import { loadResolvedLandingPage } from "@/lib/resolve-landing-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await publicHostBrand();
  return metadata;
}

export default async function HomePage() {
  const host = await getPublicHostContext();

  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    const { brand } = await publicHostBrand();
    return (
      <BrandProvider brand={brand}>
        <AuthFragmentHandler />
        <TenantUnavailable />
      </BrandProvider>
    );
  }

  if (isActivePublicTenant(host) && host.businessId) {
    const settings = await getAppSettings(host.businessId);
    const { page, businessName } = await loadResolvedLandingPage(host.businessId, settings);
    const brand = {
      ...getPortalBrandFromSettings(settings),
      name: businessName || settings.business.businessName,
    };
    return (
      <BrandProvider brand={brand}>
        <AuthFragmentHandler />
        <LandingPage brand={brand} page={page} />
      </BrandProvider>
    );
  }

  let trialDays = 14;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "platform_landing");
  } catch (err) {
    console.warn("[landing] could not load studio trial_days — using 14", err);
  }

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <AuthFragmentHandler />
      <PlatformLanding trialDays={trialDays} />
    </BrandProvider>
  );
}
