import { resolveProjectAccess } from "@/lib/project-access";
import type { TenantContext } from "@/lib/tenant";
import type { Profile } from "@/lib/types";

export type MediaAssetAccessRow = {
  id?: string;
  project_id: string | null;
  business_id: string;
};

export type MediaAssetAccessResult =
  | { ok: true; shareId: string | null }
  | { ok: false; status: 403 | 404; message: string };

function isAdminProfile(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "super_admin";
}

/**
 * Explicit project scope before any db.raw storage signing.
 * Shared viewers are limited to tenant.sharedProjectIds — never infer from business_id alone.
 */
export async function assertMediaAssetProjectAccess(
  profile: Profile,
  tenant: TenantContext,
  asset: MediaAssetAccessRow
): Promise<MediaAssetAccessResult> {
  if (asset.business_id !== tenant.businessId) {
    return { ok: false, status: 404, message: "Media not found or access denied" };
  }

  const isAdmin = isAdminProfile(profile);
  if (!asset.project_id) {
    if (isAdmin) return { ok: true, shareId: null };
    return { ok: false, status: 404, message: "Media not found or access denied" };
  }

  if (tenant.isSharedViewer) {
    const allowed = tenant.sharedProjectIds ?? [];
    if (!allowed.includes(asset.project_id)) {
      return { ok: false, status: 403, message: "Forbidden" };
    }
  }

  const access = await resolveProjectAccess(profile, asset.project_id, {
    tenantBusinessId: tenant.businessId,
  });
  if (!access.allowed) {
    return {
      ok: false,
      status: tenant.isSharedViewer ? 403 : 404,
      message: tenant.isSharedViewer ? "Forbidden" : "Media not found or access denied",
    };
  }

  if (tenant.isSharedViewer && access.kind !== "share") {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return {
    ok: true,
    shareId: access.kind === "share" ? access.shareId ?? null : null,
  };
}
