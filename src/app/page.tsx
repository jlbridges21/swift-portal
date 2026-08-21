import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AuthFragmentHandler } from "@/components/auth/auth-fragment-handler";
import { PlatformLanding } from "@/components/landing/platform-landing";
import { LandingPage } from "@/components/landing/landing-page";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { platformPortalBrand, publicHostBrand } from "@/lib/public-host-chrome";
import {
  assertActivePlanKey,
  listPublicPlans,
  resolvePlanTrialDays,
  FALLBACK_TRIAL_DAYS,
} from "@/lib/entitlements";
import { loadResolvedLandingPage } from "@/lib/resolve-landing-page";
import { marketingPageMetadata } from "@/lib/marketing";
import { SITE } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = await getPublicHostContext();
  if (isActivePublicTenant(host) || (host.kind === "tenant" && host.businessId)) {
    const { metadata } = await publicHostBrand();
    return metadata;
  }
  return marketingPageMetadata({
    title: SITE.title,
    description: SITE.description,
    path: "/",
  });
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

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "platform_landing");
  } catch (err) {
    console.warn("[landing] could not load studio trial_days — using fallback", err);
  }

  let plans: Awaited<ReturnType<typeof listPublicPlans>> = [];
  try {
    plans = await listPublicPlans();
  } catch (err) {
    console.warn("[landing] could not load public plans", err);
  }

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <AuthFragmentHandler />
      <PlatformLanding trialDays={trialDays} plans={plans} />
    </BrandProvider>
  );
}
