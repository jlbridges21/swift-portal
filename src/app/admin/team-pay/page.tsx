import { redirect } from "next/navigation";
import { Header, PageHeader } from "@/components/layout/header";
import { TeamPayPage } from "@/components/admin/team-pay/team-pay-page";
import { requireAdminPage } from "@/lib/admin-access";
import { isOwnerAdmin, staffCan, staffHomePath } from "@/lib/staff-access";
import { buildPeriodOverview } from "@/lib/team-pay/server";
import { getUiExperience } from "@/lib/ui-rollout-server";

export const dynamic = "force-dynamic";

/**
 * Team pay: what the business owes each team member for the pay period.
 * The owner, or staff given "Review & approve team pay". Hidden until it's turned on in Settings.
 */
export default async function AdminTeamPayPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { profile, tenant } = await requireAdminPage();
  const owner = isOwnerAdmin(profile);
  if (!owner && !staffCan(profile, "teampay.approve")) redirect(staffHomePath(profile));
  const { start } = await searchParams;
  const overview = await buildPeriodOverview(tenant.businessId, { start: start ?? null });
  // Not set up (or switched off): Settings is where it starts.
  if (!overview.ready || !overview.settings.enabled) redirect(owner ? "/admin/settings#settings-team-pay" : staffHomePath(profile));

  const body = <TeamPayPage initial={overview} canConfigure={owner} />;
  if ((await getUiExperience(profile)).mode === "new") {
    return (
      <div className="min-h-screen bg-background">
        <main className="app-page mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <PageHeader title="Team pay" description="What you owe your team for their shoots" />
          {body}
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Team pay" description="What you owe your team for their shoots" />
        {body}
      </main>
    </div>
  );
}
