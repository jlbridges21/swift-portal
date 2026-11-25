import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { outlookDailyUpkeep } from "@/lib/outlook-calendar";

/**
 * Daily at 16:20 UTC: refresh each Outlook connection's Microsoft token (refresh tokens lapse
 * after ~90 days unused) and retry shoots whose Outlook sync failed. Returns counts only.
 *
 * GET /api/cron/outlook-calendar
 * GET /api/cron/outlook-calendar?dryRun=1
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("outlook_calendar_connections").select("business_id").eq("status", "active");
  if (error) {
    // Before migration v137 the table doesn't exist: nothing to do.
    return NextResponse.json({ connections: 0, skipped: true });
  }
  const connections = data?.length ?? 0;
  if (cronDryRunRequested(request)) return NextResponse.json({ dryRun: true, connections });

  let refreshed = 0;
  let retried = 0;
  for (const row of data ?? []) {
    const result = await outlookDailyUpkeep(row.business_id as string);
    if (result.ok) refreshed += 1;
    retried += result.retried;
  }
  return NextResponse.json({ connections, refreshed, retried });
}
