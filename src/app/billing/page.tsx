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
import { ManageBillingButton } from "@/components/billing/billing-actions";
import { BillingPlansWithPromo } from "@/components/billing/billing-plans-with-promo";
import {
  customerIdForMode,
  listPublicPlansWithModePrices,
  loadBillingBusiness,
} from "@/lib/stripe-billing";
import { getStripeMode } from "@/lib/stripe";

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

export default async function BillingPage() {
  const { tenant } = await requireAdminPage();

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

  const sub = getSubscriptionState({
    ...tenant.business,
    subscription_current_period_end: billingRow?.subscription_current_period_end,
    subscription_cancel_at_period_end: billingRow?.subscription_cancel_at_period_end,
  });
  const planLabel = currentPlan?.name || tenant.business.plan || "Unknown plan";
  const hasStripeCustomer = Boolean(billingRow && customerIdForMode(billingRow, stripeMode));

  const headline = sub.isComped
    ? "You’re covered"
    : sub.requiresPayment
      ? "Reactivate your portal"
      : sub.status === "trialing"
        ? "You’re on a trial"
        : sub.status === "past_due"
          ? "Payment needs attention"
          : "Billing";

  const description = sub.isComped
    ? "No payment required. Your studio keeps full access under complimentary ShootPortal access."
    : sub.requiresPayment
      ? sub.reason || "Subscribe to restore full admin access."
      : sub.status === "trialing" && sub.daysLeftInTrial != null
        ? `${sub.daysLeftInTrial} day${sub.daysLeftInTrial === 1 ? "" : "s"} left on your trial. Subscribe anytime — you won’t be charged until the trial ends.`
        : sub.status === "past_due"
          ? "Your account stays open while payment is retried. Update your card in Manage billing."
          : sub.reason || "Your ShootPortal subscription is active.";

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
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-heading sm:text-3xl">{headline}</h1>
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
                <Badge variant={sub.requiresPayment ? "warning" : "success"}>{sub.status}</Badge>
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
              {!sub.isComped && tenant.business.trial_ends_at && (
                <p className="text-muted">
                  Trial ends {new Date(tenant.business.trial_ends_at).toLocaleString()}
                </p>
              )}
              {!sub.isComped && billingRow?.subscription_current_period_end && (
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

          {!sub.isComped && (
            <>
              <h2 className="mb-3 text-lg font-semibold text-heading">Plans</h2>
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
                  currentPlanKey={tenant.business.plan}
                  requiresPayment={sub.requiresPayment}
                  status={sub.status}
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
