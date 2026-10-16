import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AuthFragmentHandler } from "@/components/auth/auth-fragment-handler";
import { PlatformLanding } from "@/components/landing/platform-landing";
import { LandingPage } from "@/components/landing/landing-page";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { MarketingRoot } from "@/components/marketing/marketing-root";
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

/**
 * Host resolution (`getPublicHostContext`) reads request headers, so this shared `/`
 * route cannot be statically generated or ISR'd without splitting tenant vs platform
 * onto different entry points. Doing that would risk serving the wrong landing.
 * Keep force-dynamic; marketing weight is deferred via dynamic() on ProductDemo.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = await getPublicHostContext();
  if (isActivePublicTenant(host) || (host.kind === "tenant" && host.businessId)) {
    const { metadata } = await publicHostBrand();
    return metadata;
  }
  // Platform homepage only (tenants return above). SITE.description stays the tenant fallback.
  return marketingPageMetadata({
    title: `${SITE.name}: Run Your Media Business in One Place`,
    description:
      "Requests, estimates, scheduling, client portal, video review, payments, and delivery in one platform for photographers, videographers, and drone pilots.",
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

  // Independent queries: run in parallel to cut server response time on the marketing homepage.
  const [studioResult, plansResult] = await Promise.allSettled([assertActivePlanKey("studio"), listPublicPlans()]);

  let trialDays = FALLBACK_TRIAL_DAYS;
  if (studioResult.status === "fulfilled") {
    trialDays = resolvePlanTrialDays(studioResult.value, "platform_landing");
  } else {
    console.warn("[landing] could not load studio trial_days — using fallback", studioResult.reason);
  }

  let plans: Awaited<ReturnType<typeof listPublicPlans>> = [];
  if (plansResult.status === "fulfilled") {
    plans = plansResult.value;
  } else {
    console.warn("[landing] could not load public plans", plansResult.reason);
  }

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <AuthFragmentHandler />
      <MarketingRoot>
        <PlatformLanding trialDays={trialDays} plans={plans} />
      </MarketingRoot>
    </BrandProvider>
  );
}
