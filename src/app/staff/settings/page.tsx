import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { StaffNotificationPrefs } from "@/components/admin/staff-notification-prefs";
import { staffHasAnyArea, staffHomePath } from "@/lib/staff-access";

/**
 * Staff account prefs — notification channels only.
 * Studio settings / billing remain owner-admin.
 */
export default async function StaffSettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.disabled_at) redirect("/login?error=unavailable");
  if (profile.role === "admin") redirect("/admin/settings");
  if (profile.role === "super_admin") redirect("/platform");
  if (profile.role === "client") redirect("/dashboard/settings");
  if (profile.role !== "staff") redirect("/dashboard");

  const tenant = await getTenantContext();
  if (!tenant) redirect("/login?error=unavailable");

  const home = staffHasAnyArea(profile) ? staffHomePath(profile) : "/staff";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Staff</p>
            <p className="text-sm font-semibold">{tenant.business.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={home}>
              <Button type="button" size="sm" variant="outline">
                Back
              </Button>
            </Link>
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" size="sm" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your preferences</h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as {profile.email}. These controls affect only your account.
          </p>
        </div>
        <StaffNotificationPrefs profile={profile} />
      </main>
    </div>
  );
}
