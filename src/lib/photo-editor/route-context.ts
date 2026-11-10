import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import type { Profile } from "@/lib/types";
import { PHOTO_EDITOR_SETUP_MESSAGE } from "./server";

export type EditorRouteContext =
  | { ok: true; profile: Profile; businessId: string }
  | { ok: false; response: NextResponse };

/**
 * Auth for Photo Editor routes. Opening the editor needs the Media area; anything that
 * writes (drafts, saving, restoring) needs `media.organize` — the same permission that
 * renames / moves photos. Each route then opens its own createTenantServiceClient and
 * checks project scoping per photo.
 */
export async function editorRouteContext(mode: "view" | "edit"): Promise<EditorRouteContext> {
  const auth = await requireAdminApi(mode === "edit" ? { permission: "media.organize" } : { area: "media" });
  if (!auth.ok) return { ok: false, response: auth.response };
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false, response: missingTenantResponse(auth.profile.role) };
  return { ok: true, profile: auth.profile, businessId: tenant.businessId };
}

export function notFound(message = "Photo not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function setupRequired() {
  return NextResponse.json({ error: PHOTO_EDITOR_SETUP_MESSAGE, setupRequired: true }, { status: 503 });
}
