import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { BrandProvider } from "@/components/brand/brand-provider";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { SignupForm } from "@/components/auth/signup-form";
import { assertActivePlanKey, resolvePlanTrialDays, FALLBACK_TRIAL_DAYS } from "@/lib/entitlements";
import { isOAuthAllowedHostname } from "@/lib/oauth-origins";
import { warnOAuthCustomDomainAllowlistGaps } from "@/lib/oauth-allowlist-audit";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const host = await getPublicHostContext();
  // Defense in depth — middleware also blocks tenant hosts.
  if (host.kind === "tenant") notFound();

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "signup_page");
  } catch (err) {
    console.warn("[signup] could not load studio trial_days — using fallback", err);
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
      />
    </BrandProvider>
  );
}
