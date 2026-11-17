import { NextResponse } from "next/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { sendDueShootReminders } from "@/lib/booking/reminders";

/**
 * Sends reminders before confirmed shoots (Settings → Instant Booking → Reminders).
 * Every 15 minutes. One indexed query for upcoming un-reminded shoots across businesses.
 *
 * GET /api/cron/shoot-reminders
 * GET /api/cron/shoot-reminders?dryRun=1
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const dryRun = cronDryRunRequested(request);
  try {
    const result = await sendDueShootReminders({ dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    console.error("[cron/shoot-reminders]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Reminder run failed" }, { status: 500 });
  }
}
