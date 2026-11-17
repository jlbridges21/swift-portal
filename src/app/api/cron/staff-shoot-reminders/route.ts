import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";
import { notifyTeamMember } from "@/lib/notifications";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { addDaysToKey, formatZoned, zonedParts } from "@/lib/booking/time";
import { isValidTimeZone, type StaffNotificationEventKey } from "@/lib/staff-account-shared";

/**
 * Shoot reminders for team members (hourly). Each person gets, in their own time zone:
 *   day_before — from 5 PM the day before the shoot
 *   morning_of — from 7 AM on the shoot day (until the shoot starts)
 * Who: the person the shoot is assigned to; legacy shoots with no assignee go to the staff on
 * the project. Only staff (owners/admins aren't reminded). Each person's Settings choices apply.
 *
 * Exactly once: a staff_shoot_reminders row is claimed before sending (v134). Without that
 * table nothing is sent, so a missing migration can never cause repeats.
 */

const HOUR = 60 * 60 * 1000;
const DAY_BEFORE_HOUR = 17;
const MORNING_OF_HOUR = 7;

type Kind = "day_before" | "morning_of";
const EVENT: Record<Kind, StaffNotificationEventKey> = {
  day_before: "reminder_day_before",
  morning_of: "reminder_morning_of",
};

/** Which reminder is due now for a shoot, in the person's time zone (null = none). */
function dueReminder(nowMs: number, startMs: number, timeZone: string): Kind | null {
  if (startMs <= nowMs) return null;
  const now = zonedParts(nowMs, timeZone);
  const shootDay = zonedParts(startMs, timeZone).dayKey;
  const hour = Math.floor(now.minuteOfDay / 60);
  if (now.dayKey === shootDay && hour >= MORNING_OF_HOUR) return "morning_of";
  if (now.dayKey === addDaysToKey(shootDay, -1) && hour >= DAY_BEFORE_HOUR) return "day_before";
  return null;
}

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const dryRun = cronDryRunRequested(request);
  const nowMs = Date.now();

  const raw = await createServiceClient();
  // Reminder table present? (v134) — without it we can't guarantee "once", so send nothing.
  const probe = await raw.from("staff_shoot_reminders").select("proposal_id").limit(1);
  if (probe.error) {
    return NextResponse.json({ skipped: "migration_v134_missing" });
  }

  const { data: shoots, error } = await raw
    .from("shoot_proposals")
    .select("id, business_id, project_id, proposed_at, assigned_user_id, projects(project_name, property_address)")
    .eq("status", "confirmed")
    .gt("proposed_at", new Date(nowMs).toISOString())
    .lt("proposed_at", new Date(nowMs + 40 * HOUR).toISOString())
    .limit(2000);
  if (error) return NextResponse.json({ error: "Failed to list shoots" }, { status: 500 });

  const byBusiness = new Map<string, typeof shoots>();
  for (const s of shoots ?? []) {
    const list = byBusiness.get(s.business_id as string) ?? [];
    list.push(s);
    byBusiness.set(s.business_id as string, list);
  }

  let sent = 0;
  let due = 0;
  for (const [businessId, list] of byBusiness) {
    try {
      const settings = await getAppSettings(businessId);
      const businessZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
      const db = await createTenantServiceClient(businessId);

      const legacyProjectIds = list.filter((s) => !s.assigned_user_id).map((s) => s.project_id as string);
      const projectStaff = new Map<string, string[]>();
      if (legacyProjectIds.length) {
        const { data } = await db.from("project_staff").select("project_id, user_id").in("project_id", legacyProjectIds);
        for (const r of data ?? []) {
          const ids = projectStaff.get(r.project_id as string) ?? [];
          ids.push(r.user_id as string);
          projectStaff.set(r.project_id as string, ids);
        }
      }

      const userIds = new Set<string>();
      for (const s of list) {
        if (s.assigned_user_id) userIds.add(s.assigned_user_id as string);
        else for (const id of projectStaff.get(s.project_id as string) ?? []) userIds.add(id);
      }
      if (!userIds.size) continue;
      const { data: people } = await db.raw
        .from("profiles")
        .select("id, role, disabled_at, time_zone")
        .eq("business_id", businessId)
        .in("id", [...userIds]);
      const staff = new Map(
        (people ?? [])
          .filter((p) => p.role === "staff" && !p.disabled_at)
          .map((p) => [p.id as string, isValidTimeZone(p.time_zone) ? (p.time_zone as string) : businessZone])
      );

      for (const s of list) {
        const startMs = Date.parse(s.proposed_at as string);
        const recipients = s.assigned_user_id ? [s.assigned_user_id as string] : (projectStaff.get(s.project_id as string) ?? []);
        const project = (s as { projects?: { project_name?: string | null; property_address?: string | null } | null }).projects;
        const where = project?.property_address?.trim() || project?.project_name || "your shoot";
        for (const userId of recipients) {
          const zone = staff.get(userId);
          if (!zone) continue;
          const kind = dueReminder(nowMs, startMs, zone);
          if (!kind) continue;
          due += 1;
          if (dryRun) continue;
          // Claim first: a conflict means this reminder already went out.
          const { error: claimError } = await db.from("staff_shoot_reminders").insert({
            proposal_id: s.id,
            user_id: userId,
            kind,
            shoot_start_at: new Date(startMs).toISOString(),
          });
          if (claimError) continue;
          const time = formatZoned(startMs, zone, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
          const day = formatZoned(startMs, zone, { weekday: "long", month: "short", day: "numeric" });
          await notifyTeamMember({
            businessId,
            userId,
            projectId: s.project_id as string,
            type: "shoot_reminder",
            event: EVENT[kind],
            title: kind === "day_before" ? `Tomorrow: shoot at ${time}` : `Today: shoot at ${time}`,
            body: `${where} · ${day} at ${time}`,
            link: `/admin/projects/${s.project_id as string}`,
          });
          sent += 1;
        }
      }
    } catch (err) {
      console.error("[cron/staff-shoot-reminders] business failed", businessId, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ dryRun, shoots: shoots?.length ?? 0, due, sent });
}
