import { getSubscriptionState } from "@/lib/subscription";

export function SubscriptionBanner({
  subscriptionStatus,
  trialEndsAt,
  compedUntil,
  subscriptionCurrentPeriodEnd,
  subscriptionCancelAtPeriodEnd,
}: {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  compedUntil?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean | null;
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

  if (sub.status === "trialing" && !sub.requiresPayment && sub.daysLeftInTrial != null) {
    const days = sub.daysLeftInTrial;
    return (
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            Trial: <strong>{days}</strong> day{days === 1 ? "" : "s"} remaining.
          </p>
          <a href="/billing" className="font-medium underline underline-offset-2">
            View plans
          </a>
        </div>
      </div>
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
          <a href="/billing" className="font-medium underline underline-offset-2">
            Billing
          </a>
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
          <a href="/billing" className="font-medium underline underline-offset-2">
            Billing
          </a>
        </div>
      </div>
    );
  }

  return null;
}
