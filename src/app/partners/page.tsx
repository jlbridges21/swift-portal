import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { PartnerApplyForm } from "@/components/marketing/partner-apply-form";
import { PartnerProgramFaq } from "@/components/marketing/partner-program-faq";
import { PartnerEarningsCalculator } from "@/components/partner/partner-earnings-calculator";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadPartnerProgramMarketingData } from "@/lib/partner-program-marketing";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Revalidate so plan / default-rate edits show without a redeploy. */
export const revalidate = 60;

export const metadata: Metadata = marketingPageMetadata({
  title: "Partner Program",
  description:
    "Earn a lifetime recurring commission by referring studios to ShootPortal. Share your link, they subscribe, you earn on their ShootPortal payments.",
  path: "/partners",
});

const AUDIENCES = [
  "Influencers",
  "Educators",
  "Coaches",
  "Community owners",
  "Photographers",
  "Drone professionals",
] as const;

export default async function PartnersMarketingPage() {
  await requirePlatformMarketingHost();
  const data = await loadPartnerProgramMarketingData();
  const rate = data.commissionRatePct;
  const planLabel = data.examplePlan?.priceMonthlyLabel ?? "—";
  const planName = data.examplePlan?.name ?? "Studio";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Partner Program
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
            Refer studios to ShootPortal. Earn {rate}% for as long as they pay.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#475569]">
            The ShootPortal Partner Program pays a{" "}
            <strong className="text-[#0F172A]">{rate}% lifetime recurring commission</strong> on
            ShootPortal subscription payments from businesses you refer — not on their client jobs.
            Share your link, they start a trial and subscribe, you earn when they pay us.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#apply">
              <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
                Apply to partner
              </Button>
            </a>
            <a href="#calculator">
              <Button variant="outline" className="min-h-11 border-[#E2E8F0] bg-white px-6">
                See example earnings
              </Button>
            </a>
          </div>
          <p className="mt-3 text-sm text-[#475569]">
            Rate and plan prices load from our live catalog — the same sources the partner dashboard
            uses.
          </p>
        </section>

        <section className="border-y border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">How referrals work</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                {
                  t: "1. Get your link",
                  d: "After approval you receive a referral code and link. Visitors who use it are attributed when they create a ShootPortal business.",
                },
                {
                  t: "2. They subscribe",
                  d: "When a referred business pays ShootPortal, you earn a commission at your rate — snapshotted on each payment.",
                },
                {
                  t: "3. Get paid",
                  d: `Commissions clear a ${data.holdDays}-day hold, then appear as payable. ShootPortal records payouts manually; you track everything in your partner dashboard.`,
                },
              ].map((s) => (
                <li key={s.t} className="rounded-xl border border-[#E2E8F0] p-5">
                  <p className="font-semibold text-[#0F172A]">{s.t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="calculator" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">Example earnings</h2>
          <p className="mt-3 max-w-2xl text-base text-[#475569]">
            This is <strong className="text-[#0F172A]">arithmetic, not a projection</strong>. It
            uses the live default partner rate ({rate}%) and the public {planName} monthly price (
            {planLabel}).
          </p>
          {data.examplePlan && data.examplePlan.priceMonthlyCents > 0 ? (
            <p className="mt-6 rounded-xl border border-[#E2E8F0] bg-white px-5 py-4 text-base text-[#0F172A]">
              Example: {data.exampleReferrals} active referrals on {planName} at{" "}
              {data.examplePlan.priceMonthlyLabel}/month × {rate}% ={" "}
              <strong>{formatCurrency(data.exampleMonthlyCommissionCents)}/mo</strong> in
              commission — only if every referral stays subscribed at that price.
            </p>
          ) : (
            <p className="mt-6 text-sm text-[#475569]">
              Public plan prices are unavailable right now — open the calculator once catalog prices
              load.
            </p>
          )}

          <div className="mt-10 rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-[#0F172A]">Interactive calculator</h3>
            <p className="mt-1 text-sm text-[#475569]">
              Same calculator partners see in their dashboard. Estimate only — not a guarantee.
            </p>
            <div className="mt-6">
              <PartnerEarningsCalculator commissionRatePct={rate} plans={data.plans} />
            </div>
          </div>
        </section>

        <section className="border-t border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">Who it is for</h2>
            <p className="mt-3 max-w-2xl text-base text-[#475569]">
              People who already talk to photographers, drone operators, and media businesses — and
              can honestly recommend a client portal that fits the work.
            </p>
            <ul className="mt-8 flex flex-wrap gap-3">
              {AUDIENCES.map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#0F172A]"
                >
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="apply" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">How to apply</h2>
          <p className="mt-3 text-base text-[#475569]">
            Tell us who you are and how you would promote ShootPortal. Approved partners get a
            referral link and dashboard — no page builder required.
          </p>
          <div className="mt-8">
            <PartnerApplyForm />
          </div>
        </section>

        <section className="border-t border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-center text-2xl font-semibold text-[#0F172A] sm:text-3xl">
              Partner FAQ
            </h2>
            <PartnerProgramFaq
              commissionRatePct={rate}
              holdDays={data.holdDays}
              monthlyPriceLabel={planLabel}
            />
          </div>
        </section>

        <MarketingCtaBand
          title="Ready to partner?"
          body="Apply above, or explore ShootPortal as a customer first — partners do not need their own subscription."
          trialLabel="Questions? hello@shootportal.app"
          secondaryHref="#apply"
          secondaryLabel="Back to application"
        />
      </MarketingShell>
    </BrandProvider>
  );
}
