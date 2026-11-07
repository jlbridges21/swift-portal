import Link from "next/link";
import { getSubscriptionState } from "@/lib/subscription";
import { formatBillingDate, intervalLabel, type ScheduledPlan } from "@/lib/trial-conversion";
import { formatUsd } from "@/lib/trial-conversion";
import {
  introCountdownLabel,
  introOfferPromptCopy,
  introOfferSavingsLabel,
  type IntervalQuote,
  type OfferDisplay,
} from "@/lib/intro-offer";

export function SubscriptionBanner({
  subscriptionStatus,
  trialEndsAt,
  compedUntil,
  subscriptionCurrentPeriodEnd,
  subscriptionCancelAtPeriodEnd,
  scheduled,
  introOffer = null,
  offer = null,
}: {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  compedUntil?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean | null;
  /** Trial user who already picked a plan (billing starts at the stored trial end). */
  scheduled?: ScheduledPlan | null;
  /** Subscribe & Save window (server time) when this account can still claim it. */
  introOffer?: { endsAt: string; nowMs: number } | null;
  /** Prices checkout will charge (intro, partner referral, or regular) — shown in the trial CTA. */
  offer?: OfferDisplay | null;
}) {
  const sub = getSubscriptionState({
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
    comped_until: compedUntil ?? null,
    subscription_current_period_end: subscriptionCurrentPeriodEnd ?? null,
    subscription_cancel_at_period_end: subscriptionCancelAtPeriodEnd ?? null,
  });

  // Comped businesses: no trial / past_due / upgrade banners.
  if (sub.isComped) return null;

  const introMs = introOffer ? new Date(introOffer.endsAt).getTime() - introOffer.nowMs : 0;
  const introLive = introOffer != null && introMs > 0;

  if (scheduled) {
    const date = formatBillingDate(scheduled.firstPaymentAt);
    const name = scheduled.interval ? `${intervalLabel(scheduled.interval)} Plan` : "Plan";
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            {scheduled.canceled ? (
              <>Scheduled plan canceled — your free trial ends <strong>{date}</strong>.</>
            ) : introLive ? (
              <>
                Your {name} Starts <strong>{date}</strong>. Prefer to start today? Save {introOfferSavingsLabel()} when
                you start before then.
              </>
            ) : (
              <>
                Your {name} Starts <strong>{date}</strong>. You won&apos;t be charged before then.
              </>
            )}
          </p>
          <Link href="/billing" className="font-medium underline underline-offset-2">
            {introLive && !scheduled.canceled ? "Start & Save" : "Billing"}
          </Link>
        </div>
      </div>
    );
  }

  if (sub.status === "trialing" && !sub.requiresPayment && sub.daysLeftInTrial != null) {
    return (
      <TrialOfferBanner
        days={sub.daysLeftInTrial}
        introLive={introLive}
        introMs={introMs}
        offer={offer}
      />
    );
  }

  if (sub.status === "past_due") {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            Payment past due — your portal stays open while billing is retried. Update payment
            details soon.
          </p>
          <Link href="/billing" className="font-medium underline underline-offset-2">
            Billing
          </Link>
        </div>
      </div>
    );
  }

  if (
    (sub.status === "active" || sub.status === "canceled") &&
    subscriptionCancelAtPeriodEnd &&
    !sub.requiresPayment &&
    subscriptionCurrentPeriodEnd
  ) {
    return (
      <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            Subscription cancels at period end (
            {new Date(subscriptionCurrentPeriodEnd).toLocaleDateString()}). Access continues until
            then.
          </p>
          <Link href="/billing" className="font-medium underline underline-offset-2">
            Billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function shortPrice(q: IntervalQuote): string {
  if (q.interval === "monthly") {
    return q.introInvoices > 1
      ? `${formatUsd(q.introChargeCents)}/mo for ${q.introInvoices} months`
      : `${formatUsd(q.firstChargeCents)} your first month`;
  }
  return `${formatUsd(q.firstChargeCents)} your first year`;
}

/**
 * Trial banner: a real call to action. With Subscribe & Save (or a partner discount) it leads
 * with the savings and the actual prices; otherwise it's a plain countdown + Subscribe Now.
 */
function TrialOfferBanner({
  days,
  introLive,
  introMs,
  offer,
}: {
  days: number;
  introLive: boolean;
  introMs: number;
  offer: OfferDisplay | null;
}) {
  const dayLabel = `${days} day${days === 1 ? "" : "s"}`;
  const kind = introLive ? "intro" : offer?.kind === "referral" ? "referral" : "none";
  const discounted = (["monthly", "annual"] as const)
    .map((k) => offer?.quotes[k])
    .filter((q): q is IntervalQuote => q != null && q.savingsCents > 0);

  if (kind === "none" || discounted.length === 0) {
    return (
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            Free Trial — <strong>{days}</strong> Day{days === 1 ? "" : "s"} Remaining
          </p>
          <Link href="/billing" className="font-medium underline underline-offset-2">
            Subscribe Now
          </Link>
        </div>
      </div>
    );
  }

  const urgent = kind === "intro" ? introOfferPromptCopy(introMs).urgent : days <= 3;
  const save = kind === "intro" ? introOfferSavingsLabel() : null;
  const countdown = kind === "intro" ? introCountdownLabel(introMs) : dayLabel;
  const prices = discounted.map((q) => shortPrice(q)).join(" or ");

  // One slim row on every admin page — the single place Subscribe & Save is promoted in the app
  // (besides the billing page itself and the milestone modal). Calm until the last 3 days.
  return (
    <div
      className={
        urgent
          ? "border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950"
          : "border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-950"
      }
      data-sp-banner={kind === "intro" ? "trial:subscribe_save" : "trial:referral"}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p className="min-w-0 text-sm leading-snug">
          <span
            className={
              urgent
                ? "mr-2 hidden rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white sm:inline-block"
                : "mr-2 hidden rounded-full bg-emerald-600 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white sm:inline-block"
            }
          >
            {save ? `Save ${save}` : "Partner price"}
          </span>
          <strong className="font-semibold">
            {save
              ? urgent
                ? `Last chance to save ${save}`
                : `Start your subscription today and save ${save}`
              : "Start today with your partner discount"}
          </strong>
          <span className="hidden opacity-80 lg:inline"> — {prices}</span>
          <span className="opacity-80">
            {" "}
            · {kind === "intro" ? "ends in" : ""} {countdown}
            {kind === "intro" ? "" : " left in trial"}
          </span>
        </p>
        <Link
          href="/billing"
          className={
            urgent
              ? "inline-flex min-h-9 shrink-0 items-center rounded-md bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700"
              : "inline-flex min-h-9 shrink-0 items-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          }
          data-sp-cta={kind === "intro" ? "banner:subscribe_save" : "banner:subscribe_referral"}
        >
          {save ? (
            <>
              <span className="sm:hidden">Save {save}</span>
              <span className="hidden sm:inline">Subscribe &amp; Save {save}</span>
            </>
          ) : (
            "Subscribe Now"
          )}
        </Link>
      </div>
    </div>
  );
}
