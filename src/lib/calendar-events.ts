/**
 * Calendar events (v139): events on the Shoot Calendar that aren't a project's shoot — personal
 * blocks, meetings, errands. They block the assigned team member in Instant Booking and are
 * written to the business's Google and/or Outlook calendar (the calendar chosen for shoots).
 *
 * Google/Outlook writes reuse the exported event helpers; the shoot sync code is untouched.
 * Google copies carry the ShootPortal iCalUID/extended property, so the calendar pull never shows
 * them twice; Outlook copies are excluded by their stored event id.
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import {
  deleteGoogleEvent,
  getGoogleCalendarAccess,
  resolveBusinessTimeZone,
  upsertGoogleEvent,
} from "@/lib/google-calendar";
import { deleteOutlookEvent, getOutlookAccess, upsertOutlookEvent } from "@/lib/outlook-calendar";

export type CalendarEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  service_id: string | null;
  created_by: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  outlook_event_id: string | null;
  outlook_calendar_id: string | null;
  sync_error: string | null;
};

export type CalendarEventInput = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startIso?: string;
  endIso?: string;
  assignedUserId?: string | null;
  serviceId?: string | null;
};

const COLUMNS =
  "id, title, description, location, start_at, end_at, assigned_user_id, service_id, created_by, google_event_id, google_calendar_id, outlook_event_id, outlook_calendar_id, sync_error";

const MAX_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

export class CalendarEventsNotReady extends Error {
  constructor() {
    super("Events without a project need database migration v139 (calendar events).");
  }
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

/** Validates times: start < end, at most 7 days long. */
export function normalizeEventTimes(startIso: unknown, endIso: unknown): { start: string; end: string } | { error: string } {
  const start = typeof startIso === "string" ? Date.parse(startIso) : NaN;
  const end = typeof endIso === "string" ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { error: "Choose a start and end time." };
  if (end <= start) return { error: "The end time must be after the start time." };
  if (end - start > MAX_SPAN_MS) return { error: "Events can be at most 7 days long." };
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export async function listCalendarEvents(
  businessId: string,
  fromIso: string,
  toIso: string,
  opts: { onlyUserId?: string } = {}
): Promise<{ ready: boolean; events: CalendarEventRow[] }> {
  const db = await createTenantServiceClient(businessId);
  let query = db
    .from("calendar_events")
    .select(COLUMNS)
    .lt("start_at", toIso)
    .gt("end_at", fromIso)
    .order("start_at", { ascending: true })
    .limit(1000);
  if (opts.onlyUserId) query = query.eq("assigned_user_id", opts.onlyUserId);
  const { data, error } = await query;
  if (error) return { ready: !isMissingTable(error), events: [] };
  return { ready: true, events: (data ?? []) as CalendarEventRow[] };
}

export async function getCalendarEvent(businessId: string, id: string): Promise<CalendarEventRow | null> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("calendar_events").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new CalendarEventsNotReady();
    throw new Error("Couldn't load the event.");
  }
  return (data as CalendarEventRow | null) ?? null;
}

export async function createCalendarEvent(
  businessId: string,
  actorId: string,
  input: CalendarEventInput
): Promise<CalendarEventRow> {
  const times = normalizeEventTimes(input.startIso, input.endIso);
  if ("error" in times) throw new Error(times.error);
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("calendar_events")
    .insert({
      title: clean(input.title, 200) ?? "",
      description: clean(input.description, 5000),
      location: clean(input.location, 500),
      start_at: times.start,
      end_at: times.end,
      assigned_user_id: input.assignedUserId ?? actorId,
      service_id: input.serviceId ?? null,
      created_by: actorId,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new CalendarEventsNotReady();
    throw new Error("Couldn't save the event.");
  }
  const row = data as CalendarEventRow;
  return syncCalendarEventSafe(businessId, row);
}

export async function updateCalendarEvent(
  businessId: string,
  id: string,
  input: CalendarEventInput
): Promise<CalendarEventRow> {
  const current = await getCalendarEvent(businessId, id);
  if (!current) throw new Error("This event was removed. Refresh and try again.");
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = clean(input.title, 200) ?? "";
  if (input.description !== undefined) patch.description = clean(input.description, 5000);
  if (input.location !== undefined) patch.location = clean(input.location, 500);
  if (input.assignedUserId !== undefined) patch.assigned_user_id = input.assignedUserId;
  if (input.serviceId !== undefined) patch.service_id = input.serviceId;
  if (input.startIso !== undefined || input.endIso !== undefined) {
    const times = normalizeEventTimes(input.startIso ?? current.start_at, input.endIso ?? current.end_at);
    if ("error" in times) throw new Error(times.error);
    patch.start_at = times.start;
    patch.end_at = times.end;
  }
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("calendar_events").update(patch).eq("id", id).select(COLUMNS).single();
  if (error || !data) throw new Error("Couldn't save the event.");
  return syncCalendarEventSafe(businessId, data as CalendarEventRow);
}

export async function deleteCalendarEvent(businessId: string, id: string): Promise<void> {
  const current = await getCalendarEvent(businessId, id);
  if (!current) return;
  await Promise.all([
    current.google_event_id
      ? getGoogleCalendarAccess(businessId)
          .then((g) =>
            g.ok ? deleteGoogleEvent(g.token, current.google_calendar_id || g.defaultCalendarId, current.google_event_id!) : null
          )
          .catch(() => null)
      : null,
    current.outlook_event_id
      ? getOutlookAccess(businessId)
          .then((o) => (o.ok ? deleteOutlookEvent(o.token, current.outlook_event_id!) : null))
          .catch(() => null)
      : null,
  ]);
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete the event.");
}

/**
 * Writes the event to every connected calendar (Google and/or Outlook). Never throws: a failed
 * write is recorded in sync_error and the event stays in ShootPortal.
 */
export async function syncCalendarEventSafe(businessId: string, row: CalendarEventRow): Promise<CalendarEventRow> {
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};
  const summary = row.title || "Busy";
  const description = row.description || "";

  try {
    const g = await getGoogleCalendarAccess(businessId);
    if (g.ok) {
      const settings = await getAppSettings(businessId);
      const timeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
      const calendarId = g.defaultCalendarId;
      // The write calendar changed since last time: remove the old copy first.
      if (row.google_event_id && row.google_calendar_id && row.google_calendar_id !== calendarId) {
        await deleteGoogleEvent(g.token, row.google_calendar_id, row.google_event_id).catch(() => null);
        row.google_event_id = null;
      }
      const result = await upsertGoogleEvent(g.token, {
        proposalId: `cev-${row.id}`,
        calendarId,
        existingEventId: row.google_event_id,
        summary,
        description,
        startIso: row.start_at,
        endIso: row.end_at,
        timeZone,
        location: row.location ?? null,
      });
      patch.google_event_id = result.eventId;
      patch.google_calendar_id = calendarId;
    }
  } catch (err) {
    errors.push(`Google: ${err instanceof Error ? err.message.slice(0, 160) : "sync failed"}`);
  }

  try {
    const o = await getOutlookAccess(businessId);
    if (o.ok && o.row.calendar_id) {
      const calendarId = o.row.calendar_id;
      if (row.outlook_event_id && row.outlook_calendar_id && row.outlook_calendar_id !== calendarId) {
        await deleteOutlookEvent(o.token, row.outlook_event_id).catch(() => null);
        row.outlook_event_id = null;
      }
      const result = await upsertOutlookEvent(o.token, {
        calendarId,
        existingEventId: row.outlook_event_id,
        summary,
        description,
        startIso: row.start_at,
        endIso: row.end_at,
        location: row.location ?? null,
      });
      patch.outlook_event_id = result.eventId;
      patch.outlook_calendar_id = calendarId;
    }
  } catch (err) {
    errors.push(`Outlook: ${err instanceof Error ? err.message.slice(0, 160) : "sync failed"}`);
  }

  patch.sync_error = errors.length ? errors.join(" · ") : null;
  try {
    const db = await createTenantServiceClient(businessId);
    const { data } = await db.from("calendar_events").update(patch).eq("id", row.id).select(COLUMNS).single();
    if (data) return data as CalendarEventRow;
  } catch {
    // The event itself is saved; sync ids are best-effort.
  }
  return { ...row, ...(patch as Partial<CalendarEventRow>) };
}

/** Busy intervals for Instant Booking (the member's own events). Empty before v139. */
export async function loadCalendarEventBusy(
  businessId: string,
  userIds: string[],
  fromMs: number,
  toMs: number
): Promise<Map<string, { start: number; end: number; label: string }[]>> {
  const out = new Map<string, { start: number; end: number; label: string }[]>();
  if (!userIds.length) return out;
  try {
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db
      .from("calendar_events")
      .select("assigned_user_id, start_at, end_at")
      .in("assigned_user_id", userIds)
      .lt("start_at", new Date(toMs).toISOString())
      .gt("end_at", new Date(fromMs).toISOString());
    if (error) return out;
    for (const r of (data ?? []) as { assigned_user_id: string; start_at: string; end_at: string }[]) {
      const list = out.get(r.assigned_user_id) ?? [];
      list.push({ start: Date.parse(r.start_at), end: Date.parse(r.end_at), label: "Busy" });
      out.set(r.assigned_user_id, list);
    }
  } catch {
    // Missing table / read failure: no extra busy time (shoots and calendars still apply).
  }
  return out;
}
