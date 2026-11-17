import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { getAppSettings } from "@/lib/app-settings";
import { loadStaffAccount } from "@/lib/staff-account";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { StaffAccountSettings } from "@/components/staff-account/staff-account-settings";

export const metadata = { title: "Settings" };

/**
 * A team member's own Settings: profile, sign-in, availability, notifications, preferences and
 * what they can access. Owners and admins manage the business in /admin/settings.
 */
export default async function StaffAccountPage() {
  const { profile, tenant } = await requireAdminPage();
  if (profile.role !== "staff") redirect("/admin/settings");

  // Sign-in email vs. profile email: the v134 trigger keeps them in step; this covers the
  // window before it's applied. new_email = a change still waiting for confirmation.
  let pendingEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    pendingEmail = (user as { new_email?: string | null } | null)?.new_email ?? null;
    if (user?.email && user.email.toLowerCase() !== profile.email.toLowerCase()) {
      const db = await createTenantServiceClient(tenant.businessId);
      await db.raw.from("profiles").update({ email: user.email }).eq("id", profile.id);
      profile.email = user.email;
    }
  } catch {
    /* best effort */
  }

  const settings = await getAppSettings(tenant.businessId);
  const data = await loadStaffAccount({
    profile,
    businessId: tenant.businessId,
    businessName: tenant.business.name,
    settings,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="staff" />
      <main className="app-page mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader
          title="Settings"
          description={`Your own account at ${tenant.business.name}. Changes here affect only you.`}
        />
        <Suspense>
          <StaffAccountSettings data={data} pendingEmail={pendingEmail} />
        </Suspense>
      </main>
    </div>
  );
}
