import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadBusinessDetail } from "@/lib/platform-dashboard";
import { BusinessDetailActions } from "@/components/platform/business-detail-actions";
import { PROTECTED_PRODUCTION_BUSINESS_IDS } from "@/lib/platform-session";
import { listAllPlans, type PlanRow } from "@/lib/entitlements";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PlatformBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const [detail, plans] = await Promise.all([loadBusinessDetail(id), listAllPlans()]);
  if (!detail) notFound();

  const currentPlan: PlanRow | null = plans.find((p) => p.key === detail.business.plan) ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-heading">{detail.business.name}</h1>
      <p className="mb-6 text-muted">
        <a className="underline" href={detail.portalUrl}>
          {detail.portalUrl}
        </a>
      </p>

      {detail.stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted">Clients</CardTitle>
            </CardHeader>
            <CardContent>{detail.stats.clientCount}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted">Projects</CardTitle>
            </CardHeader>
            <CardContent>{detail.stats.projectCount}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted">Media</CardTitle>
            </CardHeader>
            <CardContent>{detail.stats.mediaCount}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted">Revenue</CardTitle>
            </CardHeader>
            <CardContent>{formatCurrency(detail.stats.lifetimeRevenueCents)}</CardContent>
          </Card>
        </div>
      )}
      <p className="mb-6 text-sm text-muted">
        Source{" "}
        <span className="font-medium text-heading">
          {detail.business.created_via === "signup" ? "self-serve signup" : "platform console"}
        </span>
        {" · "}
        Plan <span className="font-medium text-heading">{detail.business.plan}</span>
        {" · "}
        Subscription{" "}
        <span className="font-medium text-heading">{detail.business.subscription_status}</span>
        {detail.business.subscription_status === "trialing" && detail.business.trial_ends_at
          ? ` · trial ends ${formatDate(detail.business.trial_ends_at)}`
          : ""}
        {detail.stats?.isComped
          ? ` · ${detail.business.comped_reason || "comped"}${
              detail.business.comped_until == null
                ? " (permanent)"
                : detail.stats.daysLeftInComp != null
                  ? ` (${detail.stats.daysLeftInComp}d left)`
                  : ""
            }`
          : detail.stats?.daysLeftInTrial != null && !detail.stats.requiresPayment
            ? ` · ${detail.stats.daysLeftInTrial}d trial left`
            : ""}
        {detail.stats?.requiresPayment ? " · paywalled" : ""}
        {" · "}
        Created {formatDate(detail.business.created_at)}
      </p>

      <BusinessDetailActions
        business={detail.business}
        admins={detail.admins}
        settingsJson={JSON.stringify(detail.settings, null, 2)}
        isProtected={PROTECTED_PRODUCTION_BUSINESS_IDS.has(detail.business.id)}
        plans={plans}
        currentPlan={currentPlan}
      />
    </main>
  );
}
