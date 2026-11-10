import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isUuidLike } from "@/lib/website/settings";
import { serveHeroMedia } from "@/lib/website/hero-media";

export const dynamic = "force-dynamic";

/** Editor preview of a hero photo/video chosen but not saved yet (owner admins, own business only). */
export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const { assetId } = await params;
  if (!isUuidLike(assetId)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return serveHeroMedia(tenant.businessId, assetId, request, "private");
}
