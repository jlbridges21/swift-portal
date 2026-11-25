import { redirect } from "next/navigation";
import { Header, PageHeader } from "@/components/layout/header";
import { MyPay } from "@/components/admin/team-pay/my-pay";
import { requireAdminPage } from "@/lib/admin-access";
import { isOwnerAdmin, staffHomePath } from "@/lib/staff-access";
import { buildMyPay } from "@/lib/team-pay/my-pay";
import { getUiExperience } from "@/lib/ui-rollout-server";

export const dynamic = "force-dynamic";

/** My pay: a team member's own shoots, hours and what they've earned. Only when Team pay is on. */
export default async function AdminMyPayPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { profile, tenant } = await requireAdminPage();
  const { start } = await searchParams;
  const data = await buildMyPay(tenant.businessId, profile.id, start ?? null);
  if (!data.enabled) redirect(isOwnerAdmin(profile) ? "/admin" : staffHomePath(profile));

  const body = <MyPay initial={data} />;
  if ((await getUiExperience(profile)).mode === "new") {
    return (
      <div className="min-h-screen bg-background">
        <main className="app-page mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <PageHeader title="My pay" description="What you've earned from your shoots" />
          {body}
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="My pay" description="What you've earned from your shoots" />
        {body}
      </main>
    </div>
  );
}
