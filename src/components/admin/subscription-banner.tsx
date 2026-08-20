import { getSubscriptionState } from "@/lib/subscription";

export function SubscriptionBanner({
  subscriptionStatus,
  trialEndsAt,
}: {
  subscriptionStatus: string;
  trialEndsAt: string | null;
}) {
  const sub = getSubscriptionState({
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
  });

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

  return null;
}
