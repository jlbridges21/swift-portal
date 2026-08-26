import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { PartnerApplyForm } from "@/components/marketing/partner-apply-form";
import { PartnerProgramFaq } from "@/components/marketing/partner-program-faq";
import { PartnerEarningsCalculator } from "@/components/partner/partner-earnings-calculator";
import { PartnerHeroVizLazy } from "@/components/marketing/partners/hero-viz-lazy";
import { OneTimeVsRecurring } from "@/components/marketing/partners/one-time-vs-recurring";
import { ReferralSteps } from "@/components/marketing/partners/referral-steps";
import { AudienceScenarios } from "@/components/marketing/partners/audience-scenarios";
import { AudienceCards } from "@/components/marketing/partners/audience-cards";
import { WhyShootPortalCards } from "@/components/marketing/partners/why-cards";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadPartnerProgramMarketingData } from "@/lib/partner-program-marketing";
import { Button } from "@/components/ui/button";

/** Revalidate so plan / default-rate edits show without a redeploy. */
export const revalidate = 60;

export const metadata: Metadata = marketingPageMetadata({
  title: "Partner Program",
  description:
    "Turn your audience into recurring income. Refer photographers, drone pilots, and media businesses to ShootPortal and earn a recurring commission for as long as they remain paying customers.",
  path: "/partners",
});

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
      {children}
    </p>
  );
}

export default async function PartnersMarketingPage() {
  await requirePlatformMarketingHost();
  const data = await loadPartnerProgramMarketingData();
  const rate = data.commissionRatePct;
  const planLabel =
    data.examplePlan?.priceMonthlyCents && data.examplePlan.priceMonthlyCents > 0
      ? data.examplePlan.priceMonthlyLabel
      : "$29";
  const perReferralMonthlyCents =
    data.examplePlan && data.examplePlan.priceMonthlyCents > 0
      ? Math.round((data.examplePlan.priceMonthlyCents * rate) / 100)
      : Math.round((2900 * rate) / 100);

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.14), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 72%, #F1F5F9 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-14 lg:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>PARTNER PROGRAM</SectionEyebrow>
              <h1 className="mt-4 text-[2rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08] lg:text-[3.25rem] lg:leading-[1.05]">
                Turn your audience into recurring income.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg">
                Refer photographers, drone pilots, and media businesses to ShootPortal and earn{" "}
                {rate}% of their ShootPortal subscription payments for as long as they remain paying
                customers.
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-base text-[#475569]">
                You bring the audience. ShootPortal handles the product, billing, tracking, and
                recurring commissions.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="#apply" className="inline-flex">
                  <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA]">
                    Join the Partner Program
                  </Button>
                </a>
                <a href="#calculator" className="inline-flex">
                  <Button
                    variant="outline"
                    className="min-h-12 border-[#E2E8F0] bg-white/80 px-6 text-base font-medium text-[#0F172A] hover:bg-white"
                  >
                    See what you could earn
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-[#475569]">
                No ShootPortal subscription required to become a partner.
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                Your referral activity, commissions, and payouts are tracked in your partner
                dashboard.
              </p>
            </div>

            <div className="relative mx-auto mt-12 max-w-5xl lg:mt-14">
              <PartnerHeroVizLazy
                commissionRatePct={rate}
                perReferralMonthlyCents={perReferralMonthlyCents}
              />
            </div>
          </div>
        </section>

        {/* Why it adds up */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>WHY IT ADDS UP</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                One referral can keep paying you month after month.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                This is not a one time referral bonus. When someone you refer becomes a paying
                ShootPortal customer, you earn your commission each time they pay ShootPortal, for
                as long as they stay subscribed.
              </p>
            </div>
            <div className="mt-10 lg:mt-12">
              <OneTimeVsRecurring commissionRatePct={rate} />
            </div>
          </div>
        </section>

        {/* How referrals work */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Share ShootPortal. We track the rest.
              </h2>
            </div>
            <div className="mt-10 lg:mt-12">
              <ReferralSteps commissionRatePct={rate} />
            </div>
          </div>
        </section>

        {/* Opportunity / audience scenarios */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>THE OPPORTUNITY</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Your audience does not have to be huge.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                If you already have photographers, drone pilots, or media professionals listening to
                you, even a relatively small number of paying referrals can create meaningful
                recurring commissions over time.
              </p>
            </div>
            <div className="mt-10 lg:mt-12">
              <AudienceScenarios
                commissionRatePct={rate}
                perReferralMonthlyCents={perReferralMonthlyCents}
                planPriceLabel={planLabel}
              />
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>RUN THE NUMBERS</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                See what your referrals could be worth.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                Adjust the number of customers you refer and see how recurring commissions can add
                up over time.
              </p>
            </div>
            <div className="relative mx-auto mt-10 max-w-4xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)] sm:p-8 lg:mt-12">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60"
                style={{
                  background: "radial-gradient(circle, rgba(79,70,229,0.14), transparent 70%)",
                }}
              />
              <div className="relative">
                <PartnerEarningsCalculator commissionRatePct={rate} plans={data.plans} />
              </div>
            </div>
            <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-[#64748B]">
              This calculator shows simple math based on the current ShootPortal plan price and
              partner commission rate. It is not an earnings guarantee.
            </p>
          </div>
        </section>

        {/* Who it is for */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>BUILT FOR PEOPLE WITH AN AUDIENCE</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                If media professionals listen to you, this could be a fit.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                You do not need millions of followers. You need the right people paying attention.
              </p>
            </div>
            <div className="mt-10">
              <AudienceCards />
            </div>
          </div>
        </section>

        {/* Why ShootPortal */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>WHY SHOOTPORTAL</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Recommend something your audience can actually use.
              </h2>
            </div>
            <div className="mt-10">
              <WhyShootPortalCards />
            </div>
          </div>
        </section>

        {/* Apply */}
        <section id="apply" className="scroll-mt-24 border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12">
              <div>
                <SectionEyebrow>BECOME A PARTNER</SectionEyebrow>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                  Tell us about your audience.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#475569]">
                  We want partners who already help photographers, drone pilots, or media
                  professionals. Tell us who you reach, where you reach them, and how you would
                  introduce ShootPortal.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-[#475569]">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]" />
                    {data.autoApproveApplications
                      ? "Instant approval — your referral link and dashboard are ready right away."
                      : "Applications are reviewed to make sure the program is a good fit for both sides."}
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]" />
                    No ShootPortal subscription required to {data.autoApproveApplications ? "join" : "apply"}.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]" />
                    {data.autoApproveApplications
                      ? "Track commissions and referrals from your partner dashboard."
                      : "Approved partners get a referral link and a dashboard to track commissions."}
                  </li>
                </ul>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-1 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)]">
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-80"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(79,70,229,0.12), transparent 40%, transparent 60%, rgba(79,70,229,0.08))",
                  }}
                />
                <div className="relative rounded-[0.9rem] bg-white">
                  <PartnerApplyForm />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>FAQ</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Straight answers.
              </h2>
            </div>
            <div className="mt-10">
              <PartnerProgramFaq
                commissionRatePct={rate}
                holdDays={data.holdDays}
                monthlyPriceLabel={
                  data.examplePlan?.priceMonthlyCents && data.examplePlan.priceMonthlyCents > 0
                    ? data.examplePlan.priceMonthlyLabel
                    : ""
                }
              />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-[#0F172A]">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 70% 20%, rgba(79,70,229,0.35), transparent 55%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A5B4FC]">
                READY TO PARTNER?
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                You already built the audience. Now give it another way to pay you.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                If photographers, drone pilots, or media professionals already trust your
                recommendations, join the ShootPortal Partner Program and earn recurring
                commissions when they become paying customers.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="#apply" className="inline-flex">
                  <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white hover:bg-[#4338CA]">
                    Join the Partner Program
                  </Button>
                </a>
                <a href="#calculator" className="inline-flex">
                  <Button
                    variant="outline"
                    className="min-h-12 border-white/20 bg-transparent px-6 text-base font-medium text-white hover:bg-white/10"
                  >
                    Calculate potential earnings
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                You do not need a ShootPortal subscription to join.
              </p>
            </div>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
