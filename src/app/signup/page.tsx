import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
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
import { PARTNER_REF_COOKIE } from "@/lib/partner-referral";
import { offerDisplayForSignup } from "@/lib/intro-offer-server";
import { quotePlan, type OfferDisplay } from "@/lib/intro-offer";

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

  // Same pricing the account will get at checkout: a valid partner referral cookie ⇒ partner
  // pricing (never stacked with Subscribe & Save); otherwise the $15 Subscribe & Save offer.
  let offer: OfferDisplay & { partnerName: string | null } = {
    kind: "intro",
    quotes: quotePlan(pricing, true),
    endsAt: null,
    partnerName: null,
  };
  try {
    const jar = await cookies();
    offer = await offerDisplayForSignup(pricing, jar.get(PARTNER_REF_COOKIE)?.value ?? null, {
      ignoreReferral: Boolean(demo?.ok),
    });
  } catch (err) {
    console.warn("[signup] offer display failed — showing Subscribe & Save", err);
  }

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
        offer={offer}
        adminDemo={demo?.ok ? { adminEmail: demo.actorEmail } : null}
      />
      <MarketingScrollReset />
      <MarketingAnalytics eventType="signup_start" />
    </BrandProvider>
  );
}
