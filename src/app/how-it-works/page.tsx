import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { WorkflowStepGrid } from "@/components/marketing/workflow-steps";
import { PortalMockup, ClientPortalMockup } from "@/components/marketing/product-mockups";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { assertActivePlanKey, resolvePlanTrialDays, FALLBACK_TRIAL_DAYS } from "@/lib/entitlements";
import { formatTrialDaysLabel } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

export const metadata: Metadata = marketingPageMetadata({
  title: "How it works",
  description:
    "See how ShootPortal runs Request → Estimate → Schedule → Shoot → Review → Pay → Deliver in one branded client portal.",
  path: "/how-it-works",
});

export default async function HowItWorksPage() {
  await requirePlatformMarketingHost();

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "how_it_works");
  } catch {
    /* fallback */
  }
  const trialLabel =
    trialDays > 0
      ? `${formatTrialDaysLabel(trialDays)} Studio trial. No credit card required.`
      : "Create your studio and subscribe when ready.";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            How it works
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
            The full client path — without the tool hop.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[#475569]">
            ShootPortal is built around the work you already do: take a request, price it, schedule
            the shoot, deliver media, get paid, and hand off finals. Each step stays on the same
            project.
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

        <section className="border-y border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <WorkflowStepGrid detailed />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">
              Admin side: your command center
            </h2>
            <p className="mt-3 text-base text-[#475569]">
              Projects, calendar, messages, and media live together. You are not hunting for the
              latest link — you open the job.
            </p>
          </div>
          <PortalMockup />
        </section>

        <section className="border-t border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
            <ClientPortalMockup />
            <div>
              <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">
                Client side: simple on purpose
              </h2>
              <p className="mt-3 text-base text-[#475569]">
                Clients approve estimates, confirm shoot times, review media, pay, and download —
                in your branding. No CRM jargon, no mystery folders.
              </p>
            </div>
          </div>
        </section>

        <MarketingCtaBand
          title="Ready to try it on a real job?"
          body="Spin up a Studio trial and walk one project from request to delivery."
          trialLabel={trialLabel}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
