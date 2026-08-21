import { getSubscriptionState } from "@/lib/subscription";

/** Subtle client notice when the photographer’s subscription is paywalled. */
export function ClientSubscriptionNotice({
  subscriptionStatus,
  trialEndsAt,
  businessName,
  subscriptionCurrentPeriodEnd,
  subscriptionCancelAtPeriodEnd,
}: {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  businessName: string;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean | null;
}) {
  const sub = getSubscriptionState({
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
    subscription_current_period_end: subscriptionCurrentPeriodEnd ?? null,
    subscription_cancel_at_period_end: subscriptionCancelAtPeriodEnd ?? null,
  });
  if (!sub.requiresPayment) return null;

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm text-muted">
      <div className="mx-auto max-w-7xl">
        {businessName}’s portal subscription is paused. You can still open existing projects and
        download deliverables; new requests and messages are temporarily unavailable.
      </div>
    </div>
  );
}
