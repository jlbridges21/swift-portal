import { requireSuperAdminPage } from "@/lib/admin-access";
import { listAllPlans } from "@/lib/entitlements";
import { PlansManager } from "@/components/platform/plans-manager";

export const dynamic = "force-dynamic";

export default async function PlatformPlansPage() {
  await requireSuperAdminPage();
  const plans = await listAllPlans();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Plans</h1>
      <p className="mb-8 text-muted">
        Entitlement catalog only — no Stripe billing, trials, or proration. Only custom branding,
        custom services, and custom domain are enforced today; other flags are marked “not yet
        enforced”.
      </p>
      <PlansManager initialPlans={plans} />
    </main>
  );
}
