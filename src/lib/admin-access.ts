import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Profile } from "@/lib/types";

/**
 * /platform page access. Super_admin only.
 * Business admins go to /admin, everyone else to /dashboard.
 */
export async function requireSuperAdminPage(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return profile;
}

/**
 * /admin page access:
 * - admin → their business tenant
 * - super_admin with impersonation cookie → that business
 * - super_admin without impersonation → /platform (not /dashboard)
 * - everyone else → /dashboard
 */
export async function requireAdminPage(): Promise<{ profile: Profile; tenant: TenantContext }> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.role === "super_admin") {
    const tenant = await getTenantContext();
    if (!tenant) {
      redirect("/platform?notice=impersonate");
    }
    return { profile, tenant };
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/login?error=unavailable");
  }
  return { profile, tenant };
}
