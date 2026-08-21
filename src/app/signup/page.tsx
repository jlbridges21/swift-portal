import { notFound } from "next/navigation";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { BrandProvider } from "@/components/brand/brand-provider";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { SignupForm } from "@/components/auth/signup-form";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const host = await getPublicHostContext();
  // Defense in depth — middleware also blocks tenant hosts.
  if (host.kind === "tenant") notFound();

  let trialDays = 14;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "signup_page");
  } catch (err) {
    console.warn("[signup] could not load studio trial_days — using 14", err);
  }

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <SignupForm platformRootDomain={getPlatformRootDomain()} trialDays={trialDays} />
    </BrandProvider>
  );
}
