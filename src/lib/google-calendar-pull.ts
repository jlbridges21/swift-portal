/**
 * Phase 2 — live Google Calendar pull for the owner calendar.
 * No event bodies are persisted. Callers pass a time window.
 * syncToken is only for the daily cursor refresh; a 410 discards it and
 * refetches the window so the calendar page still renders.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ExternalCalendarEvent = {
  id: string;
  title: string;
  calendarId: string;
  calendarSummary: string;
  htmlLink: string | null;
  allDay: boolean;
  /** Date-time instant, or YYYY-MM-DD for an all-day event. */
  start: string;
  end: string | null;
  /** Civil dates in the business timezone. All-day events use Google's date, not UTC midnight. */
  dayKeys: string[];
  timeLabel: string;
  /** Google calendarList backgroundColor. Display only; not stored. */
  calendarColor?: string | null;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  iCalUID?: string;
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
};

const MAX_PAGES = 8;
const MAX_EVENTS = 500;
const MAX_DAY_SPAN = 120;

/** Empty stored selection means "the write target only". */
export function resolveReadCalendarIds(
  stored: string[] | null | undefined,
  writeTarget: string | null | undefined
): string[] {
  const ids = [...new Set((stored ?? []).map((s) => s.trim()).filter(Boolean))];
  if (ids.length) return ids;
  const write = (writeTarget || "primary").trim() || "primary";
  return [write];
}

/** Keeps only calendars the account can write. Does not force the write target in. */
export function validateReadCalendarSelection(requested: string[], writableIds: string[]): string[] {
  const allowed = new Set(writableIds);
  const picked: string[] = [];
  for (const raw of requested) {
    const id = raw.trim();
    if (!id || !allowed.has(id) || picked.includes(id)) continue;
    picked.push(id);
  }
  return picked;
}

/** ShootPortal pushes stamp this private prop and an iCalUID. Those are not external. */
export function isShootPortalOriginated(event: {
  iCalUID?: string;
  extendedProperties?: { private?: Record<string, string> };
}): boolean {
  const proposalId = event.extendedProperties?.private?.shootPortalProposalId;
  if (typeof proposalId === "string" && proposalId.trim()) return true;
  return (event.iCalUID || "").endsWith("@shootportal.app");
}

export function isDeclinedByOwner(event: {
  attendees?: { self?: boolean; responseStatus?: string }[];
}): boolean {
  return (event.attendees ?? []).some((a) => a.self === true && a.responseStatus === "declined");
}

export function shouldDisplayGoogleEvent(event: GoogleEvent): boolean {
  if (event.status === "cancelled") return false;
  if (isShootPortalOriginated(event)) return false;
  if (isDeclinedByOwner(event)) return false;
  if (!event.start?.date && !event.start?.dateTime) return false;
  return true;
}

/** Admins see the live pull. Staff receive nothing, including from a mistaken caller. */
export function externalEventsVisibleTo(role: string, events: ExternalCalendarEvent[]): ExternalCalendarEvent[] {
  if (role === "admin" || role === "super_admin") return events;
  return [];
}

export function zonedDayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addIsoDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function datesInclusive(start: string, end: string): string[] {
  const keys: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < MAX_DAY_SPAN) {
    keys.push(cursor);
    cursor = addIsoDate(cursor, 1);
    guard += 1;
  }
  return keys.length ? keys : [start];
}

function wallClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function zonedHourMinute(iso: string, timeZone: string): { hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return { hour, minute: get("minute") };
}

export function toExternalEvent(
  event: GoogleEvent,
  calendarId: string,
  calendarSummary: string,
  timeZone: string,
  calendarColor?: string | null
): ExternalCalendarEvent | null {
  if (!shouldDisplayGoogleEvent(event)) return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  if (allDay) {
    const start = event.start?.date as string;
    const endExclusive = event.end?.date || addIsoDate(start, 1);
    const last = addIsoDate(endExclusive, -1);
    const dayKeys = datesInclusive(start, last < start ? start : last);
    return {
      id: event.id || `${calendarId}:${start}`,
      title: event.summary?.trim() || "(No title)",
      calendarId,
      calendarSummary,
      htmlLink: event.htmlLink || null,
      allDay: true,
      start,
      end: event.end?.date || null,
      dayKeys,
      timeLabel: "All day",
      calendarColor: calendarColor ?? null,
    };
  }
  const start = event.start?.dateTime as string;
  const end = event.end?.dateTime || null;
  const startKey = zonedDayKey(start, timeZone);
  let endKey = end ? zonedDayKey(end, timeZone) : startKey;
  if (end && endKey !== startKey) {
    const hm = zonedHourMinute(end, timeZone);
    if (hm.hour === "00" && hm.minute === "00") endKey = addIsoDate(endKey, -1);
  }
  if (endKey < startKey) endKey = startKey;
  const startLabel = wallClock(start, timeZone);
  const timeLabel = end ? `${startLabel} – ${wallClock(end, timeZone)}` : startLabel;
  return {
    id: event.id || `${calendarId}:${start}`,
    title: event.summary?.trim() || "(No title)",
    calendarId,
    calendarSummary,
    htmlLink: event.htmlLink || null,
    allDay: false,
    start,
    end,
    dayKeys: datesInclusive(startKey, endKey),
    timeLabel,
    calendarColor: calendarColor ?? null,
  };
}

type ListPage = {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

async function fetchEventPage(args: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  syncToken: string | null;
  pageToken?: string;
  transport: FetchLike;
}): Promise<{ status: number; page: ListPage | null }> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events`
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("maxResults", "250");
  if (args.syncToken) {
    url.searchParams.set("syncToken", args.syncToken);
    url.searchParams.set("showDeleted", "true");
  } else {
    url.searchParams.set("timeMin", args.timeMin);
    url.searchParams.set("timeMax", args.timeMax);
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", "false");
  }
  if (args.pageToken) url.searchParams.set("pageToken", args.pageToken);
  const res = await args.transport(url.toString(), {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (res.status === 410 || res.status === 429) return { status: res.status, page: null };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.replace(/ya29\.[A-Za-z0-9_\-]+/g, "[redacted]").slice(0, 300) || `events.list ${res.status}`);
  }
  const json = (await res.json()) as ListPage;
  return { status: 200, page: json };
}

async function collectWindow(args: {
  accessToken: string;
  calendarId: string;
  calendarSummary: string;
  timeZone: string;
  timeMin: string;
  timeMax: string;
  syncToken: string | null;
  calendarColor?: string | null;
  transport: FetchLike;
}): Promise<{ events: ExternalCalendarEvent[]; nextSyncToken: string | null; degraded: boolean }> {
  const events: ExternalCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let degraded = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchEventPage({ ...args, pageToken, transport: args.transport });
    if (result.status === 429) {
      console.error("[google-calendar] events.list rate limited", { calendarId: args.calendarId });
      return { events, nextSyncToken: null, degraded: true };
    }
    if (result.status === 410) {
      const err = new Error("sync_token_gone");
      (err as Error & { gone?: boolean }).gone = true;
      throw err;
    }
    const body = result.page;
    if (!body) break;
    for (const item of body.items ?? []) {
      const parsed = toExternalEvent(
        item,
        args.calendarId,
        args.calendarSummary,
        args.timeZone,
        args.calendarColor
      );
      if (!parsed) continue;
      events.push(parsed);
      if (events.length >= MAX_EVENTS) {
        degraded = true;
        return { events, nextSyncToken: body.nextSyncToken || nextSyncToken, degraded };
      }
    }
    if (body.nextSyncToken) nextSyncToken = body.nextSyncToken;
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return { events, nextSyncToken, degraded };
}

/**
 * Windowed events.list. Pass syncToken only for the daily cursor.
 * 410 discards the token and returns a full window. 429 returns whatever
 * was already collected and degraded=true. Neither throws.
 */
export async function listGoogleEvents(args: {
  accessToken: string;
  calendarId: string;
  calendarSummary: string;
  timeZone: string;
  timeMin: string;
  timeMax: string;
  syncToken?: string | null;
  calendarColor?: string | null;
  transport?: FetchLike;
}): Promise<{
  events: ExternalCalendarEvent[];
  nextSyncToken: string | null;
  resynced: boolean;
  degraded: boolean;
}> {
  const transport = args.transport ?? fetch;
  const base = { ...args, transport, syncToken: args.syncToken || null };
  try {
    const collected = await collectWindow(base);
    return { ...collected, resynced: false };
  } catch (err) {
    const gone = Boolean((err as { gone?: boolean }).gone);
    if (!gone) throw err;
    try {
      const collected = await collectWindow({ ...base, syncToken: null });
      return { ...collected, resynced: true };
    } catch (retryErr) {
      if (!(retryErr as { gone?: boolean }).gone) throw retryErr;
      return { events: [], nextSyncToken: null, resynced: true, degraded: true };
    }
  }
}
