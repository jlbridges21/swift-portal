import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { isActiveStaff } from "@/lib/staff-access";
import type { Profile } from "@/lib/types";

/** API gate for a staff member's own Settings. Owners and admins use Business Settings. */
export async function requireStaffSelf(): Promise<
  { ok: true; profile: Profile; businessId: string } | { ok: false; response: NextResponse }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isActiveStaff(profile)) {
    return { ok: false, response: NextResponse.json({ error: "Only team members use these settings." }, { status: 403 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant || (profile.business_id && profile.business_id !== tenant.businessId)) {
    return { ok: false, response: NextResponse.json({ error: "Business not found." }, { status: 404 }) };
  }
  // Impersonating platform staff must not change a team member's own account.
  if (tenant.impersonating) {
    return { ok: false, response: NextResponse.json({ error: "Read-only while impersonating." }, { status: 403 }) };
  }
  return { ok: true, profile, businessId: tenant.businessId };
}
