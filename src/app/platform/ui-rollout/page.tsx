import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadRolloutAnalytics, loadRolloutConfig } from "@/lib/ui-rollout-server";
import { PlatformUiRollout } from "@/components/platform/platform-ui-rollout";

export const dynamic = "force-dynamic";

export default async function PlatformUiRolloutPage() {
  await requireSuperAdminPage();
  const [config, analytics] = await Promise.all([loadRolloutConfig(), loadRolloutAnalytics()]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-heading">Interface rollout</h1>
      <p className="mb-6 text-sm text-muted">
        Classic and New business interfaces. Customers see Classic until you activate the optional rollout; 14 days
        later everyone moves to New automatically. Every change here is recorded in the audit log.
      </p>
      <PlatformUiRollout initialConfig={config} analytics={analytics} nowIso={new Date().toISOString()} />
    </main>
  );
}
