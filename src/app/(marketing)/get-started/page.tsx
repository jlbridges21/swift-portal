import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { assertActivePlanKey, FALLBACK_TRIAL_DAYS, resolvePlanTrialDays } from "@/lib/entitlements";
import { parseSignupSource, signupHref } from "@/lib/signup-intent";
import { formatUsd } from "@/lib/trial-conversion";

/**
 * Post-demo subscription page. Shared after a live demo (e.g. /get-started?source=demo).
 * `source` is attribution only — it never changes price, eligibility, or billing.
 * Existing signed-in customers are routed by middleware: /signup?plan=… → their /billing,
 * which shows their current plan (no second subscription) or schedules billing after a trial.
 */
export const metadata: Metadata = {
  ...marketingPageMetadata({
    title: "Get Started",
    description:
      "Choose your ShootPortal plan — monthly or annual — and start managing your photography business today.",
    path: "/get-started",
  }),
  // Shared directly with demo attendees; keep it out of search results.
  robots: { index: false, follow: true },
};

const INCLUDED = [
  "Full access to ShootPortal",
  "Every feature, no tiers",
  "Manage or cancel anytime from billing",
];

export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requirePlatformMarketingHost();
  const source = parseSignupSource((await searchParams).source) ?? "get_started";

  let trialDays = FALLBACK_TRIAL_DAYS;
  let monthlyCents: number | null = null;
  let annualPerMonthCents: number | null = null;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "get_started_page");
    monthlyCents = studio.price_monthly_cents;
    annualPerMonthCents = studio.price_annual_cents;
  } catch (err) {
    console.warn("[get-started] could not load studio plan", err);
  }
  const annualTotal = annualPerMonthCents != null ? annualPerMonthCents * 12 : null;

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="relative overflow-hidden" data-sp-cta-location="get_started">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.14), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 80%)",
            }}
          />
          <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
                Ready to Get Started with ShootPortal?
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg">
                Choose your plan and start managing your photography business with ShootPortal today.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
              <article className="mk-reveal flex flex-col rounded-3xl border border-[#E2E8F0] bg-white p-7 shadow-sm">
                <h2 className="text-lg font-semibold text-[#0F172A]">Monthly</h2>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-[#0F172A]">{formatUsd(monthlyCents)}</span>
                  <span className="text-base text-[#475569]">/month</span>
                </p>
                <p className="mt-1 text-sm text-[#475569]">Billed monthly</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {INCLUDED.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-[#475569]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link href={signupHref({ interval: "monthly", source })} className="mt-8 block" data-sp-cta="get_started:subscribe_monthly">
                  <Button className="min-h-12 w-full border-[#4F46E5] bg-white text-base font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]" variant="outline">
                    Subscribe Monthly
                  </Button>
                </Link>
              </article>

              <article className="mk-reveal relative flex flex-col rounded-3xl border border-[#4F46E5] bg-white p-7 shadow-md ring-2 ring-[#4F46E5]/15">
                <span className="absolute -top-3 left-7 rounded-full bg-[#4F46E5] px-3 py-0.5 text-xs font-semibold text-white">
                  Best Value
                </span>
                <h2 className="text-lg font-semibold text-[#0F172A]">Annual</h2>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-[#0F172A]">{formatUsd(annualTotal)}</span>
                  <span className="text-base text-[#475569]">/year</span>
                </p>
                <p className="mt-1 text-sm text-[#475569]">
                  Equivalent to {formatUsd(annualPerMonthCents)}/month · {formatUsd(annualTotal)} billed once a year
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {INCLUDED.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-[#475569]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link href={signupHref({ interval: "annual", source })} className="mt-8 block" data-sp-cta="get_started:subscribe_annual">
                  <Button className="min-h-12 w-full bg-[#4F46E5] text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA]">
                    Subscribe Annually
                  </Button>
                </Link>
              </article>
            </div>

            <p className="mx-auto mt-6 max-w-xl text-center text-sm text-[#64748B]">
              Secure checkout through Stripe. Your subscription starts as soon as payment goes through.
            </p>

            {trialDays > 0 ? (
              <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-dashed border-[#CBD5E1] bg-white/70 px-6 py-5 text-center">
                <p className="text-sm text-[#475569]">Not quite ready? Try ShootPortal free for {trialDays} days.</p>
                <Link
                  href={signupHref({ source })}
                  className="mt-1 inline-block text-sm font-semibold text-[#4F46E5] underline-offset-4 hover:underline"
                  data-sp-cta="get_started:trial"
                >
                  Start Free Trial — No Credit Card Required
                </Link>
              </div>
            ) : null}

            <p className="mt-10 text-center text-sm text-[#64748B]">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-[#4F46E5] hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
