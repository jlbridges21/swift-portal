import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

/** Same gate as Settings: owner admins only, scoped to the current business. */
export async function requireDefaultDocumentsAccess() {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false as const, response: missingTenantResponse(profile.role) };
  const db = await createTenantServiceClient(tenant.businessId);
  return { ok: true as const, profile, businessId: tenant.businessId, db };
}

export const MIGRATION_REQUIRED_MESSAGE =
  "Default documents need database migration v114 before they can be saved.";
