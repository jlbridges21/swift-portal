import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-access";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { listActivePlans } from "@/lib/entitlements";
import { getSubscriptionState } from "@/lib/subscription";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { metadataFromBusiness } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  return metadataFromBusiness(settings.business);
}

export default async function BillingPage() {
  const { tenant } = await requireAdminPage();
  const [settings, plans] = await Promise.all([
    getAppSettings(tenant.businessId),
    listActivePlans(),
  ]);
  const brand = getPortalBrandFromSettings(settings);
  const sub = getSubscriptionState(tenant.business);
  const currentPlan = plans.find((p) => p.key === tenant.business.plan) ?? null;
  const publicPlans = plans.filter((p) => p.is_public);

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
        ? `${sub.daysLeftInTrial} day${sub.daysLeftInTrial === 1 ? "" : "s"} left on your trial.`
        : sub.status === "past_due"
          ? "Your account stays open while payment is retried. Update billing when checkout is available."
          : "Your ShootPortal subscription is active.";

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
                <span className="font-medium text-heading">
                  {currentPlan?.name ?? tenant.business.plan}
                </span>
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
              {!sub.requiresPayment && (
                <p className="pt-2">
                  <Link href="/admin" className="text-accent underline underline-offset-2">
                    Back to admin
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {!sub.isComped && (
            <>
              <h2 className="mb-3 text-lg font-semibold text-heading">Plans</h2>
              <div className="mb-8 grid gap-4 sm:grid-cols-2">
                {publicPlans.map((plan) => {
                  const isCurrent = plan.key === tenant.business.plan;
                  return (
                    <Card key={plan.id} className={isCurrent ? "border-accent" : undefined}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span>{plan.name}</span>
                          {isCurrent && <Badge variant="success">Current</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-2xl font-semibold text-heading">
                          {formatPlanPrice(plan.price_monthly_cents)}
                          <span className="text-sm font-normal text-muted">/mo</span>
                        </p>
                        {plan.price_annual_cents != null && (
                          <p className="text-xs text-muted">
                            or {formatPlanPrice(plan.price_annual_cents)}/mo billed annually
                          </p>
                        )}
                        {plan.description && (
                          <p className="text-sm text-muted">{plan.description}</p>
                        )}
                        <Button type="button" className="w-full" disabled>
                          Subscribe — Coming soon
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                Self-serve checkout ships next. Until then, contact ShootPortal support if you need
                your access restored.
              </p>
            </>
          )}
        </main>
      </div>
    </BrandProvider>
  );
}
