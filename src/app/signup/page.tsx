import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { MarketingAnalytics } from "@/components/analytics/marketing-analytics";
import { MarketingScrollReset } from "@/components/marketing/marketing-scroll-reset";
import { BrandProvider } from "@/components/brand/brand-provider";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { SignupForm } from "@/components/auth/signup-form";
import { assertActivePlanKey, resolvePlanTrialDays, FALLBACK_TRIAL_DAYS } from "@/lib/entitlements";
import { isOAuthAllowedHostname } from "@/lib/oauth-origins";
import { warnOAuthCustomDomainAllowlistGaps } from "@/lib/oauth-allowlist-audit";
import { intentFromSearchParams } from "@/lib/signup-intent";
import { ADMIN_DEMO_SOURCE, resolveAdminDemoAuthorization } from "@/lib/admin-demo-signup";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; source?: string; intent?: string }>;
}) {
  const host = await getPublicHostContext();
  // Defense in depth — middleware also blocks tenant hosts.
  if (host.kind === "tenant") notFound();

  // ?plan=monthly|annual ⇒ Subscribe Now path; no plan ⇒ free trial (unchanged default).
  const intent = intentFromSearchParams(await searchParams);

  let trialDays = FALLBACK_TRIAL_DAYS;
  let pricing: { monthlyCents: number | null; annualPerMonthCents: number | null } = {
    monthlyCents: null,
    annualPerMonthCents: null,
  };
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "signup_page");
    pricing = { monthlyCents: studio.price_monthly_cents, annualPerMonthCents: studio.price_annual_cents };
  } catch (err) {
    console.warn("[signup] could not load studio trial_days — using fallback", err);
  }

  // ?source=admin-demo grants nothing by itself: the option only appears for a verified super
  // admin (signed demo cookie or super_admin session). Everyone else gets normal signup.
  const demo = intent.source === ADMIN_DEMO_SOURCE ? await resolveAdminDemoAuthorization() : null;

  const h = await headers();
  const hostname =
    (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.split(":")[0]?.trim() ?? "";
  const oauthAllowed = isOAuthAllowedHostname(hostname);
  void warnOAuthCustomDomainAllowlistGaps();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <SignupForm
        platformRootDomain={getPlatformRootDomain()}
        trialDays={trialDays}
        oauthAllowed={oauthAllowed}
        initialIntent={intent}
        pricing={pricing}
        adminDemo={demo?.ok ? { adminEmail: demo.actorEmail } : null}
      />
      <MarketingScrollReset />
      <MarketingAnalytics eventType="signup_start" />
    </BrandProvider>
  );
}
