import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { MarketingPricingGrid } from "@/components/marketing/marketing-pricing";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import {
  assertActivePlanKey,
  listPublicPlans,
  resolvePlanTrialDays,
  FALLBACK_TRIAL_DAYS,
} from "@/lib/entitlements";
import { formatTrialDaysLabel } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";

/** Revalidate so /platform plan edits show up without a redeploy. */
export const revalidate = 60;

export const metadata: Metadata = marketingPageMetadata({
  title: "Pricing",
  description:
    "ShootPortal plans for photographers, videographers, and media studios. Live prices from our plan catalog — start a free trial.",
  path: "/pricing",
});

export default async function PricingPage() {
  await requirePlatformMarketingHost();

  const plans = await listPublicPlans();

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "pricing_page");
  } catch {
    /* fallback */
  }
  const trialLabel =
    trialDays > 0
      ? `${formatTrialDaysLabel(trialDays)} Studio trial. No credit card required.`
      : "Subscribe after signup — no free trial on Studio right now.";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
            Plans that match how you shoot
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#475569]">
            Prices, limits, and trial length are loaded from the live plans table — the same source
            Stripe checkout uses. What you see is what you are charged.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
                Start free trial
              </Button>
            </Link>
            <p className="mt-3 text-sm text-[#475569]">{trialLabel}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <MarketingPricingGrid plans={plans} />
          <p className="mt-8 text-center text-sm text-[#475569]">
            Entitlements shown are features that ship today (branding, services catalog, custom
            domain). Pipeline automations, custom stages, white-label, and advanced reporting are
            reserved for future releases and are not marketed as available.
          </p>
        </section>

        <MarketingCtaBand
          title="Start with Studio, upgrade when you grow."
          body="Create your account, try the workflow on a real project, then pick the plan that fits."
          trialLabel={trialLabel}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
