import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Profile } from "@/lib/types";
import {
  isActiveStaff,
  isOwnerAdmin,
  passesAccessGate,
  staffHomePath,
  adminPathArea,
  staffMayAccessAdminPath,
  type AccessGate,
  type StaffArea,
} from "@/lib/staff-access";

export { adminPathArea, staffMayAccessAdminPath };
export type { StaffArea };

/**
 * /platform page access. Super_admin only.
 * Business admins go to /admin, staff to their home, everyone else to /dashboard.
 */
export async function requireSuperAdminPage(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") {
    if (profile.role === "admin") redirect("/admin");
    if (isActiveStaff(profile)) redirect(staffHomePath(profile));
    redirect("/dashboard");
  }
  return profile;
}

export type RequireAdminPageOpts = {
  /** Area this page belongs to — staff need the matching area.* permission. */
  area?: StaffArea;
  /** Settings, leads, billing-adjacent — staff never. */
  adminOnly?: boolean;
};

/**
 * /admin page access:
 * - admin → their business tenant
 * - super_admin with impersonation cookie → that business
 * - staff with the required area (or any area for the shell) → tenant
 * - adminOnly pages → owner admin / super_admin only
 * - staff with zero areas → /staff explanatory home
 */
export async function requireAdminPage(
  opts?: RequireAdminPageOpts
): Promise<{ profile: Profile; tenant: TenantContext }> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.disabled_at && profile.role === "staff") {
    redirect("/login?error=unavailable");
  }

  if (profile.role === "super_admin") {
    const tenant = await getTenantContext();
    if (!tenant) {
      redirect("/platform?notice=impersonate");
    }
    return { profile, tenant };
  }

  if (isOwnerAdmin(profile)) {
    const tenant = await getTenantContext();
    if (!tenant) {
      redirect("/login?error=unavailable");
    }
    return { profile, tenant };
  }

  if (isActiveStaff(profile)) {
    if (opts?.adminOnly) {
      redirect(staffHomePath(profile));
    }
    const gate: AccessGate = opts?.area
      ? { area: opts.area }
      : { anyArea: true };
    if (!passesAccessGate(profile, gate)) {
      // No area access (or wrong area) — sensible home, never error/sign-out.
      redirect(staffHomePath(profile));
    }
    const tenant = await getTenantContext();
    if (!tenant) {
      redirect("/login?error=unavailable");
    }
    return { profile, tenant };
  }

  redirect("/dashboard");
}
