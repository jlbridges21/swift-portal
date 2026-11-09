import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getMediaAssetDetail,
  getMediaAssetEvents,
  getMediaDownloadHistory,
  getRelatedAssets,
} from "@/lib/media-library";
import { LIBRARY_FILE_KINDS, type LibraryAssetKind } from "@/lib/media-library";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessMediaAsset, isOwnerAdmin, visibleProjectIdsFor } from "@/lib/staff-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin({ area: "media" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id } = await params;
    const kind = (new URL(request.url).searchParams.get("kind") ?? "photo") as LibraryAssetKind;

    const asset = await getMediaAssetDetail(tenant.businessId, id, kind);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!(await canAccessMediaAsset(tenant.businessId, profile, asset.project_id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const projectIds = isOwnerAdmin(profile)
      ? ("all" as const)
      : await visibleProjectIdsFor(tenant.businessId, profile);

    const isFileKind = LIBRARY_FILE_KINDS.includes(kind);
    const [events, downloads, related] = await Promise.all([
      isFileKind ? getMediaAssetEvents(tenant.businessId, id) : Promise.resolve([]),
      isFileKind ? getMediaDownloadHistory(tenant.businessId, id) : Promise.resolve([]),
      getRelatedAssets(tenant.businessId, asset, 6, projectIds),
    ]);

    return NextResponse.json({ asset, events, downloads, related });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
