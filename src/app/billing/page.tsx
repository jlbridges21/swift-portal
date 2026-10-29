import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-access";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { getSubscriptionState } from "@/lib/subscription";
import { formatPlanPrice } from "@/lib/plan-catalog";
import {
  formatReferralPlanPriceDisplay,
  resolveReferralDiscountForBusiness,
} from "@/lib/partner-referral-discount";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { metadataFromBusiness } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { getTenantContext } from "@/lib/tenant";
import {
  AutoStartCheckout,
  CheckoutConfirmationRefresher,
  ManageBillingButton,
  StartTrialInsteadButton,
} from "@/components/billing/billing-actions";
import { BillingPlansWithPromo } from "@/components/billing/billing-plans-with-promo";
import {
  customerIdForMode,
  listPublicPlansWithModePrices,
  loadBillingBusiness,
} from "@/lib/stripe-billing";
import { getStripeMode } from "@/lib/stripe";
import { canStartDeferredTrial, isAwaitingFirstSubscription } from "@/lib/subscription";
import {
  confirmBillingCheckoutSession,
  previewScheduledChargeCents,
  trialHandoffMode,
  type CheckoutConfirmation,
} from "@/lib/billing-subscriptions";
import { loadBillingJourney } from "@/lib/billing-journey";
import { parseSignupInterval } from "@/lib/signup-intent";
import { formatBillingDate, formatUsd, getScheduledPlan, intervalLabel } from "@/lib/trial-conversion";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import { subscriptionIdForMode } from "@/lib/stripe-billing";
import { adminHomePath } from "@/lib/onboarding";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return { title: "Billing" };
    const settings = await getAppSettings(tenant.businessId);
    return metadataFromBusiness(settings.business);
  } catch {
    return { title: "Billing" };
  }
}

type BillingSearchParams = {
  checkout?: string;
  session_id?: string;
  plan?: string;
  attempt?: string;
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<BillingSearchParams>;
}) {
  const { tenant } = await requireAdminPage({ adminOnly: true });
  const sp = await searchParams;

  let settings;
  try {
    settings = await getAppSettings(tenant.businessId);
  } catch (err) {
    console.error("[billing] page load failed", err);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-2xl font-bold text-heading">Billing</h1>
        <p className="mt-2 max-w-md text-muted">
          We couldn&apos;t load your billing details right now. You can still return to admin or try
          again shortly.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/admin">
            <Button variant="accent">Back to admin</Button>
          </Link>
          <Link href="/billing">
            <Button variant="outline">Try again</Button>
          </Link>
        </div>
      </div>
    );
  }

  const brand = getPortalBrandFromSettings(settings);

  // Back from Stripe Checkout: verify the session with Stripe (never the browser) and sync now,
  // so a delayed webhook can't leave a paying customer on the paywall.
  let confirmation: CheckoutConfirmation | null = null;
  if (sp.checkout === "success" && sp.session_id) {
    try {
      confirmation = await confirmBillingCheckoutSession(sp.session_id, tenant.businessId);
      if (confirmation.state === "activated" || confirmation.state === "scheduled") invalidateHostLookupCache();
    } catch (err) {
      console.error("[billing] checkout confirmation failed", err);
      confirmation = { state: "processing" };
    }
  }

  const billingRow = await loadBillingBusiness(tenant.businessId);
  const stripeMode = getStripeMode();
  const publicPlans = await listPublicPlansWithModePrices(stripeMode);
  const currentPlan = publicPlans.find((p) => p.key === tenant.business.plan) ?? null;
  const anyModePriceConfigured = publicPlans.some((p) => Boolean(p.stripe_price_monthly_id));

  // Same resolver as checkout — display and charge cannot diverge.
  let monthlyReferralDiscount = null as Awaited<
    ReturnType<typeof resolveReferralDiscountForBusiness>
  > | null;
  let annualReferralDiscount = null as Awaited<
    ReturnType<typeof resolveReferralDiscountForBusiness>
  > | null;
  try {
    const [monthly, annual] = await Promise.all([
      resolveReferralDiscountForBusiness({
        businessId: tenant.businessId,
        interval: "monthly",
      }),
      resolveReferralDiscountForBusiness({
        businessId: tenant.businessId,
        interval: "annual",
      }),
    ]);
    monthlyReferralDiscount = monthly;
    annualReferralDiscount = annual;
  } catch (err) {
    console.error("[billing] referral discount display resolve failed — showing list prices", err);
  }

  // Fresh row (confirmation above may have just synced it); tenant.business can be cached.
  const bizState = {
    ...tenant.business,
    ...(billingRow
      ? {
          subscription_status: billingRow.subscription_status,
          trial_ends_at: billingRow.trial_ends_at,
          plan: billingRow.plan,
        }
      : {}),
    subscription_current_period_end: billingRow?.subscription_current_period_end,
    subscription_cancel_at_period_end: billingRow?.subscription_cancel_at_period_end,
  };
  const sub = getSubscriptionState(bizState);
  const planLabel = currentPlan?.name || bizState.plan || "Unknown plan";
  const hasStripeCustomer = Boolean(billingRow && customerIdForMode(billingRow, stripeMode));

  const journey = await loadBillingJourney(tenant.businessId);
  const scheduled = getScheduledPlan({ ...bizState, journey });
  const awaitingFirst = !sub.isComped && isAwaitingFirstSubscription(bizState);
  const trialOfferAvailable = Boolean(billingRow && canStartDeferredTrial(billingRow));
  let offerTrialDays = 0;
  if (trialOfferAvailable) {
    try {
      offerTrialDays = resolvePlanTrialDays(await assertActivePlanKey(bizState.plan || "studio"), "billing_trial_offer");
    } catch {
      offerTrialDays = 0;
    }
  }
  const preferredInterval = parseSignupInterval(sp.plan) ?? journey?.preferred_interval ?? null;
  const handoff = billingRow ? trialHandoffMode(billingRow) : { kind: "none" as const, trialEndUnix: null };
  const pickerMode: "pay_now" | "schedule" = handoff.kind === "none" ? "pay_now" : "schedule";
  const trialEndLabel = bizState.trial_ends_at ? formatBillingDate(bizState.trial_ends_at) : null;

  let scheduledChargeCents: number | null = null;
  if (scheduled && !scheduled.canceled) {
    scheduledChargeCents =
      (await previewScheduledChargeCents(billingRow ? subscriptionIdForMode(billingRow, stripeMode) : null)) ??
      scheduled.amountCents;
  }
  const scheduledName = scheduled?.interval ? `${intervalLabel(scheduled.interval)} Plan` : "Plan";
  const showPicker =
    !sub.isComped && !scheduled && (sub.requiresPayment || sub.status === "trialing" || awaitingFirst);

  const headline = sub.isComped
    ? "You’re covered"
    : scheduled
      ? scheduled.canceled
        ? "Your scheduled plan was canceled"
        : `Your ${scheduledName} Is Scheduled`
      : awaitingFirst
        ? "Complete your subscription"
        : sub.requiresPayment
          ? "Reactivate your portal"
          : sub.status === "trialing"
            ? "Love ShootPortal? Lock In Your Plan."
            : sub.status === "past_due"
              ? "Payment needs attention"
              : "Billing";

  const description = sub.isComped
    ? "No payment required. Your studio keeps full access under complimentary ShootPortal access."
    : scheduled
      ? scheduled.canceled
        ? `You won't be charged. Your free trial still ends on ${formatBillingDate(scheduled.firstPaymentAt)}. Use Manage billing to restore the plan before then.`
        : `Your first payment${scheduledChargeCents != null ? ` of ${formatUsd(scheduledChargeCents)}` : ""} is scheduled for ${formatBillingDate(scheduled.firstPaymentAt)}, when your free trial ends. Until then, enjoy full access.`
      : awaitingFirst
        ? "Choose monthly or annual billing to activate your ShootPortal account. Your subscription starts as soon as payment goes through."
        : sub.requiresPayment
          ? sub.reason || "Subscribe to restore full admin access."
          : sub.status === "trialing" && sub.daysLeftInTrial != null
            ? "Choose your plan today. You won't be charged until your free trial ends."
            : sub.status === "past_due"
              ? "Your account stays open while payment is retried. Update your card in Manage billing."
              : sub.reason || "Your ShootPortal subscription is active.";

  const continuePath = adminHomePath({
    onboardingCompletedAt: tenant.business.onboarding_completed_at,
    onboardingState: tenant.business.onboarding_state,
  });
  const trialEndInFuture = Boolean(scheduled) || (sub.status === "trialing" && !sub.isExpired);
  const attempt = Math.max(0, Math.min(10, Number.parseInt(sp.attempt ?? "0", 10) || 0));

  // Subscribe Now signup arriving for the first time: go straight to Stripe Checkout for the plan
  // they picked. Only before any checkout was opened, so backing out of Stripe lands here instead.
  const checkoutPlanKey = currentPlan?.key ?? publicPlans[0]?.key ?? null;
  const autoCheckoutInterval =
    awaitingFirst &&
    !sp.checkout &&
    !tenant.impersonating &&
    anyModePriceConfigured &&
    checkoutPlanKey &&
    journey?.signup_path === "subscribe" &&
    !journey.last_checkout_session_id
      ? preferredInterval ?? journey.preferred_interval
      : null;

  if (autoCheckoutInterval && checkoutPlanKey) {
    return (
      <BrandProvider brand={brand}>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" aria-hidden />
          <h1 className="mt-6 text-xl font-semibold text-heading" role="status" aria-live="polite">
            Taking you to secure checkout…
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {intervalLabel(autoCheckoutInterval)} plan · you&apos;ll enter your payment details on Stripe.
          </p>
          <AutoStartCheckout planKey={checkoutPlanKey} interval={autoCheckoutInterval} />
        </div>
      </BrandProvider>
    );
  }

  const trialOffer =
    awaitingFirst && trialOfferAvailable && offerTrialDays > 0 ? (
      <Card className="mb-6 border-2 border-dashed border-accent/40 bg-accent/5">
        <CardContent className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold text-heading">Not quite ready to subscribe?</p>
            <p className="mt-0.5 text-sm text-muted">
              Try ShootPortal free for {offerTrialDays} days. No credit card required.
            </p>
          </div>
          <StartTrialInsteadButton trialDays={offerTrialDays} />
        </CardContent>
      </Card>
    ) : null;

  return (
    <BrandProvider brand={brand}>
      {tenant.impersonating && (
        <ImpersonationBanner
          businessName={tenant.business.name}
          businessId={tenant.businessId}
          allowWrites={tenant.allowWrites}
          subscriptionStatus={tenant.business.subscription_status}
          trialEndsAt={tenant.business.trial_ends_at}
          compedUntil={tenant.business.comped_until}
          compedReason={tenant.business.comped_reason}
        />
      )}
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-card/90 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
            <Logo href={sub.requiresPayment ? "/billing" : "/admin"} compact />
            <form action="/api/auth/signout" method="POST">
              <Button variant="ghost" size="sm" type="submit" className="min-h-11 px-3">
                Sign Out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 pb-16">
          {confirmation && (confirmation.state === "activated" || confirmation.state === "scheduled") ? (
            <Card className="mb-8 border-accent ring-2 ring-accent/15">
              <CardContent className="space-y-3 p-6 text-center sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-accent">
                  {confirmation.state === "activated" ? "Payment complete" : "Plan locked in"}
                </p>
                <h2 className="text-2xl font-bold text-heading">
                  {confirmation.state === "activated"
                    ? "You're all set — welcome to ShootPortal!"
                    : `Your ${confirmation.interval ? intervalLabel(confirmation.interval) : ""} Plan Is Scheduled`.replace("  ", " ")}
                </h2>
                <p className="text-muted">
                  {confirmation.state === "activated"
                    ? `Your ${confirmation.interval ? `${intervalLabel(confirmation.interval).toLowerCase()} ` : ""}subscription is active. A receipt is on its way to your email.`
                    : confirmation.firstPaymentAt
                      ? `You won't be charged until ${formatBillingDate(confirmation.firstPaymentAt)}, when your free trial ends. Keep exploring in the meantime.`
                      : "You won't be charged until your free trial ends."}
                </p>
                <Link href={continuePath === "/onboarding" ? "/onboarding" : "/admin"} className="inline-block pt-2">
                  <Button variant="accent" className="min-h-11 px-6">
                    {continuePath === "/onboarding" ? "Set up your studio" : "Go to your dashboard"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : confirmation?.state === "processing" ? (
            <Card className="mb-8" role="status" aria-live="polite">
              <CardContent className="p-6 text-center">
                <p className="font-semibold text-heading">Confirming your payment…</p>
                <p className="mt-1 text-sm text-muted">
                  {attempt >= 6
                    ? "This is taking longer than usual. Refresh in a minute — you won't be charged twice."
                    : "This only takes a moment. Please keep this page open."}
                </p>
                <CheckoutConfirmationRefresher attempt={attempt} />
              </CardContent>
            </Card>
          ) : (sp.checkout === "cancelled" || sp.checkout === "error") && showPicker ? (
            <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted" role="status">
              {sp.checkout === "error"
                ? "We couldn't open checkout automatically. Choose your plan below to continue."
                : "Checkout was canceled and you haven't been charged. Pick a plan whenever you're ready."}
            </div>
          ) : null}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-heading sm:text-3xl">{headline}</h1>
            {sub.status === "trialing" && !sub.isExpired && sub.daysLeftInTrial != null && !scheduled ? (
              <p className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                Free Trial — {sub.daysLeftInTrial} Day{sub.daysLeftInTrial === 1 ? "" : "s"} Remaining
              </p>
            ) : null}
            <p className="mt-2 text-muted">{description}</p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Current plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-heading">{planLabel}</span>
                {currentPlan && (
                  <span className="text-muted">
                    {" "}
                    · {formatPlanPrice(currentPlan.price_monthly_cents)}/mo
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={sub.requiresPayment ? "warning" : "success"}>
                  {scheduled ? "scheduled" : awaitingFirst ? "awaiting payment" : sub.status}
                </Badge>
                {sub.isComped && (
                  <Badge variant="success">
                    {tenant.business.comped_until == null ? "No payment required" : "Complimentary"}
                  </Badge>
                )}
                {sub.status === "trialing" && sub.daysLeftInTrial != null && !sub.isExpired && (
                  <Badge variant="default">{sub.daysLeftInTrial} days left</Badge>
                )}
                {billingRow?.subscription_cancel_at_period_end && (
                  <Badge variant="warning">Cancels at period end</Badge>
                )}
              </div>
              {sub.isComped && (
                <div className="space-y-1 pt-1 text-muted">
                  {tenant.business.comped_reason && (
                    <p>
                      Reason:{" "}
                      <span className="font-medium text-heading">{tenant.business.comped_reason}</span>
                    </p>
                  )}
                  <p>
                    {tenant.business.comped_until == null
                      ? "Complimentary access is permanent — no renewal date."
                      : `Complimentary access through ${new Date(tenant.business.comped_until).toLocaleString()}.`}
                  </p>
                </div>
              )}
              {!sub.isComped && bizState.trial_ends_at && (
                <p className="text-muted">
                  Trial {trialEndInFuture ? "ends" : "ended"}{" "}
                  {new Date(bizState.trial_ends_at).toLocaleString()}
                </p>
              )}
              {!sub.isComped && !scheduled && billingRow?.subscription_current_period_end && (
                <p className="text-muted">
                  Current period ends{" "}
                  {new Date(billingRow.subscription_current_period_end).toLocaleString()}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!sub.requiresPayment && (
                  <Link href="/admin" className="text-accent underline underline-offset-2">
                    Back to admin
                  </Link>
                )}
                {!sub.isComped && hasStripeCustomer && <ManageBillingButton />}
              </div>
            </CardContent>
          </Card>

          {!sub.isComped && !showPicker && hasStripeCustomer && (
            <p className="mb-8 text-sm text-muted">
              {scheduled && !scheduled.canceled
                ? "Need to update your card or cancel before your first payment? Use Manage billing."
                : "Use Manage billing to update your payment method, see invoices, or cancel."}
            </p>
          )}

          {showPicker && (
            <>
              <h2 className="mb-3 text-lg font-semibold text-heading">Choose your plan</h2>
              {!anyModePriceConfigured ? (
                <p className="mb-8 text-sm text-muted">
                  Billing isn&apos;t set up for this studio yet. Contact ShootPortal support.
                </p>
              ) : publicPlans.length === 0 ? (
                <p className="mb-8 text-sm text-muted">
                  Plans are temporarily unavailable. Contact ShootPortal support if you need access
                  restored.
                </p>
              ) : (
                <BillingPlansWithPromo
                  afterPlans={trialOffer}
                  mode={pickerMode}
                  firstChargeDateLabel={pickerMode === "schedule" ? trialEndLabel : null}
                  preferredInterval={preferredInterval}
                  plans={publicPlans.map((plan) => {
                    const cookieMonthlyDisplay =
                      monthlyReferralDiscount?.eligible && plan.price_monthly_cents != null
                        ? formatReferralPlanPriceDisplay({
                            listPriceCents: plan.price_monthly_cents,
                            discount: monthlyReferralDiscount,
                            interval: "monthly",
                          })
                        : null;
                    const cookieAnnualDisplay =
                      plan.price_annual_cents != null && annualReferralDiscount?.eligible
                        ? formatReferralPlanPriceDisplay({
                            listPriceCents: plan.price_annual_cents,
                            discount: annualReferralDiscount,
                            interval: "annual",
                          })
                        : null;
                    return {
                      id: plan.id,
                      key: plan.key,
                      name: plan.name,
                      price_monthly_cents: plan.price_monthly_cents,
                      price_annual_cents: plan.price_annual_cents,
                      stripe_price_monthly_id: plan.stripe_price_monthly_id,
                      stripe_price_annual_id: plan.stripe_price_annual_id,
                      cookieMonthlyDisplay,
                      cookieAnnualDisplay,
                    };
                  })}
                />
              )}
            </>
          )}
        </main>
      </div>
    </BrandProvider>
  );
}
