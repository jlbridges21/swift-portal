/**
 * Reminders before confirmed shoots. Run by /api/cron/shoot-reminders every 15 minutes.
 *
 * - One reminder per appointment row (`reminder_sent_at`). A reschedule creates a new row, so
 *   the new time gets its own reminder; cancelled and superseded rows are never picked up.
 * - Claimed with a conditional update before sending, so overlapping cron runs can't double-send.
 * - Shoots booked inside the reminder window (e.g. tomorrow's shoot booked today) are marked
 *   and skipped: the client just got a confirmation.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import type { ReminderSettings } from "@/lib/booking/settings";
import { reminderDecision, reminderWhen } from "@/lib/booking/reminder-rules";

const HOUR = 3600_000;
/** Longest lead time offered in settings (48h) plus one cron interval of slack. */
const SCAN_AHEAD_MS = 48 * HOUR + 20 * 60_000;

type DueRow = {
  id: string;
  business_id: string;
  project_id: string;
  proposed_at: string;
  created_at: string;
  assigned_user_id: string | null;
  projects: { project_name?: string | null; property_address?: string | null; deleted_at?: string | null } | null;
};

export type ReminderRunResult = {
  schemaReady: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  notDue: number;
  errors: number;
};

export async function sendDueShootReminders(options: { nowMs?: number; dryRun?: boolean } = {}): Promise<ReminderRunResult> {
  const nowMs = options.nowMs ?? Date.now();
  const result: ReminderRunResult = { schemaReady: true, scanned: 0, sent: 0, skipped: 0, notDue: 0, errors: 0 };
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("shoot_proposals")
    .select("id, business_id, project_id, proposed_at, created_at, assigned_user_id, projects(project_name, property_address, deleted_at)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("proposed_at", new Date(nowMs).toISOString())
    .lte("proposed_at", new Date(nowMs + SCAN_AHEAD_MS).toISOString())
    .order("proposed_at", { ascending: true })
    .limit(500);
  if (error) {
    // Before migration v133 the column doesn't exist: nothing to do.
    if (/reminder_sent_at/.test(error.message)) return { ...result, schemaReady: false };
    throw new Error(error.message);
  }
  const rows = (data ?? []) as unknown as DueRow[];
  result.scanned = rows.length;

  const settingsCache = new Map<string, Awaited<ReturnType<typeof getAppSettings>>>();
  for (const row of rows) {
    try {
      if (row.projects?.deleted_at) {
        result.skipped++;
        continue;
      }
      let settings = settingsCache.get(row.business_id);
      if (!settings) {
        settings = await getAppSettings(row.business_id);
        settingsCache.set(row.business_id, settings);
      }
      const reminders = settings.booking.reminders;
      const startMs = Date.parse(row.proposed_at);
      const decision = reminderDecision({ startMs, createdMs: Date.parse(row.created_at), nowMs }, reminders);
      if (decision === "not_due" || decision === "disabled") {
        result.notDue++;
        continue;
      }
      if (options.dryRun) {
        if (decision === "send") result.sent++;
        else result.skipped++;
        continue;
      }
      // Claim first: only one run sends.
      const { data: claimed } = await raw
        .from("shoot_proposals")
        .update({ reminder_sent_at: new Date(nowMs).toISOString() })
        .eq("id", row.id)
        .is("reminder_sent_at", null)
        .eq("status", "confirmed")
        .select("id");
      if (!claimed?.length) continue;
      if (decision === "skip_booked_late") {
        result.skipped++;
        continue;
      }
      await deliverReminder(row, settings, reminders, startMs, nowMs);
      result.sent++;
    } catch (err) {
      result.errors++;
      console.error("[shoot-reminders] failed", { proposalId: row.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

async function deliverReminder(
  row: DueRow,
  settings: Awaited<ReturnType<typeof getAppSettings>>,
  reminders: ReminderSettings,
  startMs: number,
  nowMs: number
) {
  const raw = await createServiceClient();
  const timeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
  const when = reminderWhen(startMs, nowMs, timeZone);
  const place = row.projects?.property_address?.trim() || row.projects?.project_name?.trim() || "your property";

  let photographer: { id: string; name: string } | null = null;
  if (row.assigned_user_id) {
    const { data } = await raw.from("profiles").select("id, full_name").eq("id", row.assigned_user_id).maybeSingle();
    if (data) photographer = { id: data.id as string, name: (data.full_name as string | null)?.trim() || "" };
  }
  const { count: teamSize } = await raw
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", row.business_id)
    .in("role", ["admin", "staff"])
    .is("disabled_at", null);
  const withName = photographer?.name && (teamSize ?? 1) > 1 ? ` with ${photographer.name.split(" ")[0]}` : "";

  if (reminders.notifyClient) {
    await notifyProjectClients({
      businessId: row.business_id,
      projectId: row.project_id,
      type: "shoot_proposed",
      eventKey: "shoot_reminder",
      title: `Reminder: your shoot is ${when}`,
      body: `Your shoot at ${place} is ${when}${withName}. Need to change it? You can reschedule from your shoot page.`,
      link: `/dashboard/projects/${row.project_id}/shoot`,
      emailSubject: `Reminder: your shoot is ${when}`,
      emailCtaLabel: "View shoot details",
      idempotencyKey: `reminder:${row.id}:client`,
    });
  }

  if (reminders.notifyPhotographer) {
    const { data: project } = await raw
      .from("projects")
      .select("clients(name, full_name)")
      .eq("id", row.project_id)
      .maybeSingle();
    const client = (project?.clients as { name?: string; full_name?: string } | null) ?? null;
    const clientName = client?.full_name || client?.name || "Client";
    // The assigned photographer, or the owner on solo businesses / legacy rows.
    let recipientId = photographer?.id ?? null;
    if (!recipientId) {
      const { data: owner } = await raw
        .from("businesses")
        .select("owner_user_id")
        .eq("id", row.business_id)
        .maybeSingle();
      recipientId = (owner?.owner_user_id as string | null) ?? null;
    }
    if (recipientId) {
      await notifyAdmins({
        businessId: row.business_id,
        projectId: row.project_id,
        type: "shoot_proposed",
        eventKey: "shoot_reminder",
        title: `Shoot ${when}`,
        body: `${clientName} · ${place}`,
        link: `/admin/calendar?shoot=${row.id}`,
        onlyUserIds: [recipientId],
        idempotencyKey: `reminder:${row.id}:staff`,
      });
    }
  }
}
