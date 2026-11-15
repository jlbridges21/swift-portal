import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { isActiveStaff, isOwnerAdmin } from "@/lib/staff-access";
import type { Profile } from "@/lib/types";

/** Academy API access: owners, admins and active staff, each acting on their own progress. */
export async function academyApiUser(): Promise<
  { ok: true; profile: Profile; tenant: TenantContext } | { ok: false; response: NextResponse }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(isOwnerAdmin(profile) || isActiveStaff(profile))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false, response: NextResponse.json({ error: "No business" }, { status: 403 }) };
  return { ok: true, profile, tenant };
}
