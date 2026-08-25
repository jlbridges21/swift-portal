import Link from "next/link";
import { PartnerEarningsCalculator } from "@/components/partner/partner-earnings-calculator";
import { PartnerInAppApplyForm } from "@/components/partner/partner-in-app-apply-form";
import { OneTimeVsRecurring } from "@/components/marketing/partners/one-time-vs-recurring";
import { ReferralSteps } from "@/components/marketing/partners/referral-steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PARTNER_COMMISSION_ON_NET_COLLECTED } from "@/lib/partner-referral-discount";
import type { PartnerApplyPrefill } from "@/lib/partner-entry";
import type { PartnerProgramMarketingData } from "@/lib/partner-program-marketing";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{children}</p>
  );
}

function formatAppliedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = {
  data: PartnerProgramMarketingData;
  prefill: PartnerApplyPrefill;
  isBusinessAdmin: boolean;
};

/**
 * In-app partner program pitch — reuses public /partners sections and live DB numbers.
 */
export function PartnerProgramPitch({ data, prefill, isBusinessAdmin }: Props) {
  const rate = data.commissionRatePct;
  const discount = data.referralDiscount;
  const discountLine =
    discount.enabled && discount.amountCents > 0 && discount.durationMonths > 0
      ? `${discount.amountLabel}/month off for their first ${discount.durationMonths} paid months`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <SectionEyebrow>ShootPortal Partners</SectionEyebrow>
            <p className="text-sm font-medium text-heading">Partner Program</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isBusinessAdmin ? (
              <Link href="/admin">
                <Button type="button" variant="outline" size="sm" className="min-h-11">
                  Business admin
                </Button>
              </Link>
            ) : null}
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>Partner Program</SectionEyebrow>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            Turn your audience into recurring income.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Refer photographers, drone pilots, and media businesses to ShootPortal and earn{" "}
            <strong>{rate}%</strong> of their ShootPortal subscription payments for as long as they
            remain paying customers.
          </p>
          <p className="mt-2 text-sm text-muted">
            Commissions are on revenue ShootPortal actually collects — not list price before
            discounts. {PARTNER_COMMISSION_ON_NET_COLLECTED}
          </p>
        </div>

        <section className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ReferralSteps commissionRatePct={rate} />
              <p className="mt-6 text-sm text-muted">
                Share your unique referral link or code. When someone signs up through it and becomes
                a paying subscriber, attribution sticks to you. Commissions enter a {data.holdDays}
                -day hold after each payment (refunds / chargebacks), then become payable on the
                platform&apos;s payout schedule.
                {discountLine ? (
                  <>
                    {" "}
                    Referred businesses get <strong>{discountLine}</strong> on monthly billing when
                    they join through your link.
                  </>
                ) : null}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Why it adds up</SectionEyebrow>
            <h2 className="mt-2 text-2xl font-semibold text-heading">
              Lifetime recurring — not a one-time bounty.
            </h2>
          </div>
          <div className="mt-6">
            <OneTimeVsRecurring commissionRatePct={rate} />
          </div>
        </section>

        <section id="calculator" className="mt-12 scroll-mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Run the numbers</SectionEyebrow>
            <h2 className="mt-2 text-2xl font-semibold text-heading">
              See what your referrals could be worth.
            </h2>
          </div>
          <div className="relative mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8">
            <PartnerEarningsCalculator commissionRatePct={rate} plans={data.plans} />
          </div>
        </section>

        <section id="apply" className="mt-12 scroll-mt-24">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionEyebrow>Become a partner</SectionEyebrow>
              <h2 className="mt-2 text-2xl font-semibold text-heading">Tell us about your audience.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                We review applications to make sure the program is a good fit. You are already signed
                in — we prefilled what we know from your profile.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li>Applications are reviewed in about 5–7 business days.</li>
                <li>Approved partners get a referral link and dashboard — no new login required.</li>
                <li>No ShootPortal subscription required to apply.</li>
              </ul>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Apply now</CardTitle>
              </CardHeader>
              <CardContent>
                <PartnerInAppApplyForm prefill={prefill} />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

export function PartnerApplicationPending({
  appliedAt,
  isBusinessAdmin,
}: {
  appliedAt: string;
  isBusinessAdmin: boolean;
}) {
  return (
    <PartnerEntryShell isBusinessAdmin={isBusinessAdmin} title="Application under review">
      <p className="text-sm text-muted">
        We received your partner application on <strong>{formatAppliedDate(appliedAt)}</strong>.
        Our team reviews applications in the order they arrive — usually within 5 to 7 business days.
      </p>
      <p className="mt-3 text-sm text-muted">
        No need to resubmit. If you have questions, email{" "}
        <a className="underline" href="mailto:hello@shootportal.app">
          hello@shootportal.app
        </a>
        .
      </p>
    </PartnerEntryShell>
  );
}

export function PartnerApplicationDeclined({ isBusinessAdmin }: { isBusinessAdmin: boolean }) {
  return (
    <PartnerEntryShell isBusinessAdmin={isBusinessAdmin} title="Application not approved">
      <p className="text-sm text-muted">
        Your partner application was reviewed and we are not moving forward at this time. This is
        not a fit for every audience, and we limit approvals so partners get meaningful support.
      </p>
      <p className="mt-3 text-sm text-muted">
        If your situation changes materially, contact{" "}
        <a className="underline" href="mailto:hello@shootportal.app">
          hello@shootportal.app
        </a>{" "}
        — please do not submit duplicate applications.
      </p>
    </PartnerEntryShell>
  );
}

export function PartnerSuspendedEntry({
  brandName,
  isBusinessAdmin,
}: {
  brandName: string;
  isBusinessAdmin: boolean;
}) {
  return (
    <PartnerEntryShell isBusinessAdmin={isBusinessAdmin} title="Partner account suspended">
      <p className="text-sm text-muted">
        Your partner account for <strong>{brandName}</strong> is suspended. Existing commission
        history is retained, but new referrals will not earn commissions until the account is
        reactivated. Contact ShootPortal support if you have questions.
      </p>
    </PartnerEntryShell>
  );
}

function PartnerEntryShell({
  title,
  isBusinessAdmin,
  children,
}: {
  title: string;
  isBusinessAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <SectionEyebrow>ShootPortal Partners</SectionEyebrow>
          {isBusinessAdmin ? (
            <Link href="/admin">
              <Button type="button" variant="outline" size="sm" className="min-h-11">
                Business admin
              </Button>
            </Link>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-heading">{title}</h1>
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}

export function PartnerApplicationWithdrawn({
  data,
  prefill,
  isBusinessAdmin,
}: {
  data: PartnerProgramMarketingData;
  prefill: PartnerApplyPrefill;
  isBusinessAdmin: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <SectionEyebrow>ShootPortal Partners</SectionEyebrow>
          {isBusinessAdmin ? (
            <Link href="/admin">
              <Button type="button" variant="outline" size="sm" className="min-h-11">
                Business admin
              </Button>
            </Link>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-heading">Previous application withdrawn</h1>
        <p className="mt-3 text-sm text-muted">
          You withdrew a prior partner application. You may apply again below if you would like to
          rejoin the review queue.
        </p>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Apply again</CardTitle>
          </CardHeader>
          <CardContent>
            <PartnerInAppApplyForm prefill={prefill} />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted">
          Commission rate: <strong>{data.commissionRatePct}%</strong> recurring on collected revenue.
        </p>
      </main>
    </div>
  );
}
