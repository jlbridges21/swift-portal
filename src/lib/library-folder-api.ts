/** Shared auth + error handling for /api/library-folders routes. */
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin, staffCan, visibleProjectIdsFor, type AccessGate } from "@/lib/staff-access";
import { LibraryFolderError, resolveLibraryItems } from "@/lib/library-folders";
import { isUuid, parseLibraryItemRef, type LibraryItemRef } from "@/lib/library-folder-types";
import type { Profile } from "@/lib/types";

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type Ok = { ok: true; profile: Profile; businessId: string };
type Denied = { ok: false; response: NextResponse };

/** Reading folders needs the Media area; changing them needs media.organize. */
export async function requireLibraryFolderAccess(write: boolean): Promise<Ok | Denied> {
  const gate: AccessGate = write ? { permission: "media.organize" } : { area: "media" };
  const auth = await requireAdminApi(gate);
  if (!auth.ok) return auth;
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false, response: missingTenantResponse(auth.profile.role) };
  return { ok: true, profile: auth.profile, businessId: tenant.businessId };
}

/**
 * Folders span projects, so actions that affect what other people see — deleting a folder, or
 * adding to a folder that is already shared (which publishes the additions) — are limited to
 * people who can see every project. Adding to a shared folder also needs a sharing permission.
 */
export async function canManageWholeFolder(businessId: string, profile: Profile, opts: { sharing?: boolean } = {}): Promise<boolean> {
  if (isOwnerAdmin(profile)) return true;
  if (opts.sharing && !staffCan(profile, "sharing.email") && !staffCan(profile, "sharing.anyone_with_link")) return false;
  return (await visibleProjectIdsFor(businessId, profile)) === "all";
}

export function badFolderId(id: string): NextResponse | null {
  return isUuid(id) ? null : NextResponse.json({ error: "Folder not found." }, { status: 404 });
}

export function folderErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof LibraryFolderError) {
    return NextResponse.json({ error: err.message, setupRequired: err.status === 503 }, { status: err.status });
  }
  console.error(`[library-folders] ${context} failed`, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/**
 * Parse `items` (["kind:id", …] or [{kind,id}]) and keep only assets this user may see:
 * they must exist in this business, and scoped staff may only touch assets in their projects
 * (unassigned media is owner/view-all only, as in the library itself).
 */
export async function authorizedItemRefs(
  businessId: string,
  profile: Profile,
  raw: unknown
): Promise<{ refs: LibraryItemRef[]; denied: number; invalid: number }> {
  const list = Array.isArray(raw) ? raw : [];
  const parsed: LibraryItemRef[] = [];
  let invalid = 0;
  for (const v of list) {
    const ref = parseLibraryItemRef(v);
    if (ref) parsed.push(ref);
    else invalid += 1;
  }
  const found = await resolveLibraryItems(businessId, parsed);
  invalid += parsed.length - found.length;
  if (isOwnerAdmin(profile)) return { refs: found.map((f) => f.ref), denied: 0, invalid };
  const visible = await visibleProjectIdsFor(businessId, profile);
  if (visible === "all") return { refs: found.map((f) => f.ref), denied: 0, invalid };
  const allowed = new Set(visible);
  const refs = found.filter((f) => f.projectId && allowed.has(f.projectId)).map((f) => f.ref);
  return { refs, denied: found.length - refs.length, invalid };
}
