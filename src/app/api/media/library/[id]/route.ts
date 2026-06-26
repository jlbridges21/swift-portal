import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getMediaAssetDetail,
  getMediaAssetEvents,
  getMediaDownloadHistory,
  getRelatedAssets,
} from "@/lib/media-library";
import type { LibraryAssetKind } from "@/lib/media-library";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const kind = (new URL(request.url).searchParams.get("kind") ?? "photo") as LibraryAssetKind;

    const asset = await getMediaAssetDetail(id, kind);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [events, downloads, related] = await Promise.all([
      kind !== "tour" ? getMediaAssetEvents(id) : Promise.resolve([]),
      kind !== "tour" ? getMediaDownloadHistory(id) : Promise.resolve([]),
      getRelatedAssets(asset),
    ]);

    return NextResponse.json({ asset, events, downloads, related });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
