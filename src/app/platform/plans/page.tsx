import { requireSuperAdminPage } from "@/lib/admin-access";
import { listAllPlans } from "@/lib/entitlements";
import { PlansManager } from "@/components/platform/plans-manager";
import { PlanStripePriceConsistencyAlert } from "@/components/platform/plan-stripe-price-consistency-alert";
import { getPlanSubscriberPriceBreakdown } from "@/lib/plan-subscriber-prices";
import { checkPlanStripePriceConsistency } from "@/lib/sync-plan-stripe-prices";

export const dynamic = "force-dynamic";

export default async function PlatformPlansPage() {
  await requireSuperAdminPage();
  const [plans, consistency] = await Promise.all([
    listAllPlans(),
    checkPlanStripePriceConsistency(),
  ]);
  const breakdownEntries = await Promise.all(
    plans
      .filter((p) => p.key !== "founding")
      .map(async (p) => [p.key, await getPlanSubscriberPriceBreakdown(p.key)] as const)
  );
  const subscriberBreakdowns = Object.fromEntries(breakdownEntries);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Plans</h1>
      <p className="mb-8 text-muted">
        Catalog prices sync to Stripe for new Checkout sessions. Existing subscribers keep their
        Stripe Price until they change plans. Only custom branding, custom services, and custom
        domain are enforced today; other flags are marked “not yet enforced”.
      </p>
      <PlanStripePriceConsistencyAlert
        mode={consistency.modeChecked}
        mismatches={consistency.mismatches}
      />
      <PlansManager initialPlans={plans} subscriberBreakdowns={subscriberBreakdowns} />
    </main>
  );
}
