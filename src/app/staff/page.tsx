import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { staffHasAnyArea, staffHomePath } from "@/lib/staff-access";

/**
 * Staff home — redirect to first permitted area, or explanatory empty state
 * when the member has zero area permissions.
 */
export default async function StaffHomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.disabled_at) {
    redirect("/login?error=unavailable");
  }

  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "super_admin") redirect("/platform");
  if (profile.role === "client") redirect("/dashboard");
  if (profile.role !== "staff") redirect("/dashboard");

  const tenant = await getTenantContext();
  if (!tenant) {
    // Has staff role but no tenant context — fail soft to login, not portal_unavailable sign-out loop.
    redirect("/login?error=unavailable");
  }

  if (staffHasAnyArea(profile)) {
    redirect(staffHomePath(profile));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Staff</p>
            <p className="text-sm font-semibold">{tenant.business.name}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <Button type="submit" size="sm" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {profile.full_name || "teammate"}
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Your staff account is ready. An admin hasn&apos;t assigned project access or permissions
          yet — once they do, your work will show up here.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as {profile.email}. You don&apos;t have admin settings or billing access.
        </p>
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No projects assigned</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask your studio admin to add you to a project when they&apos;re ready.
          </p>
        </div>
        <p className="mt-8 text-xs text-slate-400">Need help? Contact your studio admin.</p>
      </main>
    </div>
  );
}
