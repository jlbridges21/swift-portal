import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { MarketingHomePricing } from "@/components/marketing/marketing-home-pricing";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import {
  assertActivePlanKey,
  listPublicPlans,
  resolvePlanTrialDays,
  FALLBACK_TRIAL_DAYS,
} from "@/lib/entitlements";
import {
  formatPlanPrice,
  formatTrialDaysLabel,
} from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";

/** Revalidate so /platform plan edits show up without a redeploy. */
export const revalidate = 60;

export const metadata: Metadata = marketingPageMetadata({
  title: "Pricing",
  description:
    "One ShootPortal plan with monthly or annual billing. Live prices from our plan catalog. Start a free trial with no credit card required.",
  path: "/pricing",
});

export default async function PricingPage() {
  await requirePlatformMarketingHost();

  const plans = await listPublicPlans();
  const studioPlan =
    plans.find((p) => p.key === "studio") ??
    plans.find((p) => p.key !== "founding") ??
    plans[0];

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "pricing_page");
  } catch {
    /* fallback */
  }

  const annualPriceLabel = studioPlan?.price_annual_cents
    ? formatPlanPrice(studioPlan.price_annual_cents)
    : studioPlan
      ? formatPlanPrice(studioPlan.price_monthly_cents)
      : "$24";

  const trialLabel =
    trialDays > 0
      ? `${formatTrialDaysLabel(trialDays)} Studio trial. No credit card required.`
      : "Subscribe after signup. No free trial on Studio right now.";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
            Everything you need. Starting at {annualPriceLabel} a month.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#475569]">
            One plan with the full ShootPortal experience. Manage your clients, projects, shoots,
            media, invoices, and payments without paying for a stack of separate tools.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
                Start your free trial
              </Button>
            </Link>
            <p className="mt-3 text-sm text-[#475569]">{trialLabel}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <MarketingHomePricing plan={studioPlan ?? null} trialDays={trialDays} />
          <p className="mt-8 text-center text-sm text-[#475569]">
            Prices load from the live plans catalog, the same source Stripe checkout uses. What you
            see is what you are charged when you subscribe.
          </p>
        </section>

        <MarketingCtaBand
          title="One plan. Full ShootPortal."
          body="Create your account, run a real project on trial, then choose monthly or annual billing when you subscribe."
          trialLabel={trialLabel}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
