import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { ensureStorageSnapshot } from "@/lib/platform-economics";

export const maxDuration = 60;

/** Re-measure storage now (one scan of storage.objects). */
export async function POST() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const snap = await ensureStorageSnapshot({ force: true });
    return NextResponse.json({
      day: snap.day,
      computedAt: snap.computedAt,
      source: snap.source,
      totalBytes: snap.totalBytes,
      businesses: snap.byBusiness.size,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Snapshot failed" }, { status: 500 });
  }
}
