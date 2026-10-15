import { NextResponse } from "next/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Marketing analytics retention (docs/ANALYTICS.md):
 * - events and sessions older than ANALYTICS_RETENTION_DAYS (default 395)
 * - cookieless salts older than 2 days (makes old cookieless keys unlinkable)
 * Attribution snapshots live with their business and are not touched.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const days = Math.max(30, Number(process.env.ANALYTICS_RETENTION_DAYS) || 395);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const saltCutoff = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const dryRun = cronDryRunRequested(request);
  const db = await createServiceClient();

  if (dryRun) {
    const [events, sessions, salts] = await Promise.all([
      db.from("analytics_events").select("id", { count: "exact", head: true }).lt("occurred_at", cutoff),
      db.from("analytics_sessions").select("id", { count: "exact", head: true }).lt("started_at", cutoff),
      db.from("analytics_daily_salts").select("day", { count: "exact", head: true }).lt("day", saltCutoff),
    ]);
    return NextResponse.json({ dryRun: true, retentionDays: days, events: events.count, sessions: sessions.count, salts: salts.count });
  }

  const events = await db.from("analytics_events").delete({ count: "exact" }).lt("occurred_at", cutoff);
  // Sessions cascade-delete any remaining events.
  const sessions = await db.from("analytics_sessions").delete({ count: "exact" }).lt("started_at", cutoff);
  const salts = await db.from("analytics_daily_salts").delete({ count: "exact" }).lt("day", saltCutoff);
  const error = events.error || sessions.error || salts.error;
  if (error) {
    console.error("[cron/analytics-retention] failed", error.message);
    return NextResponse.json({ error: "Analytics retention failed" }, { status: 500 });
  }
  return NextResponse.json({ retentionDays: days, deleted: { events: events.count, sessions: sessions.count, salts: salts.count } });
}
