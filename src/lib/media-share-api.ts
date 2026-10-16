import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessMediaAsset, staffCan } from "@/lib/staff-access";
import { loadShareablePhoto, type ShareablePhoto } from "@/lib/media-shares";
import type { MediaShareState } from "@/lib/media-share-types";
import type { Profile } from "@/lib/types";

export type PhotoSharePermissions = { email: boolean; link: boolean };

export function photoSharePermissions(profile: Profile | null | undefined): PhotoSharePermissions {
  return {
    email: staffCan(profile, "sharing.email"),
    link: staffCan(profile, "sharing.anyone_with_link"),
  };
}

/** Hide the link URL from users who may not manage "anyone with the link". */
export function shareStateFor(state: MediaShareState, perms: PhotoSharePermissions): MediaShareState {
  if (perms.link || !state.link) return state;
  return { ...state, link: { ...state.link, url: null } };
}

type Gate =
  | { error: NextResponse }
  | { error?: undefined; profile: Profile; businessId: string; photo: ShareablePhoto; perms: PhotoSharePermissions };

/**
 * Owner/staff gate for one photo's shares: a sharing permission, the photo's
 * project must be visible to this user, and the photo must be shareable.
 * Unknown or inaccessible photos are 404 so existence is not confirmed.
 */
export async function requirePhotoShareAccess(mediaId: string): Promise<Gate> {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const perms = photoSharePermissions(profile);
  if (!perms.email && !perms.link) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };

  const photo = await loadShareablePhoto(tenant.businessId, mediaId);
  if (!photo || !(await canAccessMediaAsset(tenant.businessId, profile, photo.project_id))) {
    return { error: NextResponse.json({ error: "Photo not found." }, { status: 404 }) };
  }
  return { profile, businessId: tenant.businessId, photo, perms };
}
