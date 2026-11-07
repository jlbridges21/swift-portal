import { NextResponse } from "next/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { ensureStorageSnapshot } from "@/lib/platform-economics";

export const maxDuration = 60;

/**
 * Daily storage snapshot for Platform Economics (docs/PLATFORM-ECONOMICS.md): one grouped
 * scan of storage.objects → platform_storage_snapshots + business_storage_snapshots.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  if (cronDryRunRequested(request)) return NextResponse.json({ dryRun: true });
  try {
    const snap = await ensureStorageSnapshot({ force: true });
    return NextResponse.json({ day: snap.day, source: snap.source, totalBytes: snap.totalBytes, businesses: snap.byBusiness.size });
  } catch (error) {
    console.error("[cron/platform-economics] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
  }
}
