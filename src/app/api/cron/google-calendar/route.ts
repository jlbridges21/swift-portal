import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { pollGoogleCalendarSync } from "@/lib/google-calendar";

/**
 * Refresh Google sync cursors once a day at 16:15 UTC.
 * The owner calendar also pulls the visible window live when it is opened.
 * This route stores nextSyncToken only. It does not return event titles or times.
 *
 * GET /api/cron/google-calendar
 * GET /api/cron/google-calendar?dryRun=1
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("business_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  const connections = data?.length ?? 0;
  if (cronDryRunRequested(request)) {
    return NextResponse.json({ dryRun: true, connections });
  }

  let refreshed = 0;
  let resynced = 0;
  let degraded = 0;
  for (const row of data ?? []) {
    const result = await pollGoogleCalendarSync(row.business_id);
    if (!result.skipped) refreshed += 1;
    resynced += result.resynced;
    if (result.degraded) degraded += 1;
  }

  return NextResponse.json({ connections, refreshed, resynced, degraded });
}
