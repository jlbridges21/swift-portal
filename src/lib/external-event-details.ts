/**
 * Full details for one Google or Outlook event, fetched when the owner opens it on the Shoot
 * Calendar (description, location, video call, guests, attachments). Fetched on demand so the
 * week/month load stays small; nothing here is stored.
 *
 * Descriptions are converted to plain text on the server; the client renders text only
 * (links are made clickable there), never HTML from the calendar provider.
 */

export type ExternalEventPerson = {
  name: string | null;
  email: string | null;
  /** accepted | declined | tentative | needsAction | organizer | none */
  response: string | null;
  organizer: boolean;
  optional: boolean;
  self: boolean;
};

export type ExternalEventDetails = {
  description: string | null;
  location: string | null;
  meeting: { url: string; label: string; phone: string | null } | null;
  organizer: { name: string | null; email: string | null } | null;
  attendees: ExternalEventPerson[];
  attachments: { title: string; url: string }[];
  recurring: boolean;
  /** busy | free | tentative | oof | workingElsewhere */
  showAs: string | null;
  visibility: string | null;
  /** What the editor needs. canEdit is false for invitations and read-only calendars. */
  edit: ExternalEventEditInfo;
};

export type ExternalEventEditInfo = {
  canEdit: boolean;
  allDay: boolean;
  /** ISO instant, or YYYY-MM-DD for all-day (end exclusive). */
  start: string | null;
  end: string | null;
  canAddMeeting: boolean;
  canRemoveMeeting: boolean;
  /** Google lets us choose whether guests get an email; Outlook always notifies them. */
  canChooseNotify: boolean;
};

const NO_EDIT: ExternalEventEditInfo = {
  canEdit: false,
  allDay: false,
  start: null,
  end: null,
  canAddMeeting: false,
  canRemoveMeeting: false,
  canChooseNotify: false,
};

const MAX_DESCRIPTION = 8000;
const MAX_ATTENDEES = 100;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/** Google/Outlook HTML descriptions → readable plain text (links kept as their URL). */
export function htmlToText(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input);
  if (/<[a-z!/][^>]*>/i.test(s)) {
    s = s
      .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // <a href="url">text</a> → "text (url)" unless the text already is the url.
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
        const label = text.replace(/<[^>]+>/g, "").trim();
        if (!label || label === href || href.startsWith("mailto:")) return label || href;
        return `${label} (${href})`;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table)>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }
  s = s
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, code: string) => {
      const key = code.toLowerCase();
      if (key in ENTITIES) return ENTITIES[key];
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16) || 32);
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10) || 32);
      return m;
    })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) return null;
  return s.length > MAX_DESCRIPTION ? `${s.slice(0, MAX_DESCRIPTION)}…` : s;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function safeUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ── Google ─────────────────────────────────────────────────────────────────

type GoogleDetailEvent = {
  description?: string;
  location?: string;
  hangoutLink?: string;
  recurringEventId?: string;
  transparency?: string;
  visibility?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  creator?: { email?: string; displayName?: string };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    optional?: boolean;
    self?: boolean;
    resource?: boolean;
  }[];
  conferenceData?: {
    conferenceSolution?: { name?: string };
    entryPoints?: { entryPointType?: string; uri?: string; label?: string; pin?: string }[];
  };
  attachments?: { title?: string; fileUrl?: string }[];
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  guestsCanModify?: boolean;
  eventType?: string;
  locked?: boolean;
};

export function googleEventDetails(
  e: GoogleDetailEvent,
  ctx: { calendarId?: string; writable?: boolean } = {}
): ExternalEventDetails {
  const entries = e.conferenceData?.entryPoints ?? [];
  const video = entries.find((p) => p.entryPointType === "video" && safeUrl(p.uri));
  const phone = entries.find((p) => p.entryPointType === "phone");
  const videoUrl = safeUrl(video?.uri) ?? safeUrl(e.hangoutLink);
  const solution = str(e.conferenceData?.conferenceSolution?.name);
  const meeting = videoUrl
    ? {
        url: videoUrl,
        label: solution ? `Join ${solution}` : /meet\.google\.com/.test(videoUrl) ? "Join Google Meet" : "Join video call",
        phone: phone ? [str(phone.label) ?? str(phone.uri)?.replace(/^tel:/, ""), phone.pin ? `PIN ${phone.pin}` : null].filter(Boolean).join(" · ") || null : null,
      }
    : null;
  const organizer = e.organizer
    ? { name: str(e.organizer.displayName), email: str(e.organizer.email) }
    : e.creator
      ? { name: str(e.creator.displayName), email: str(e.creator.email) }
      : null;
  const attendees: ExternalEventPerson[] = (e.attendees ?? [])
    .filter((a) => !a.resource)
    .slice(0, MAX_ATTENDEES)
    .map((a) => ({
      name: str(a.displayName),
      email: str(a.email),
      response: a.organizer ? "organizer" : str(a.responseStatus),
      organizer: Boolean(a.organizer),
      optional: Boolean(a.optional),
      self: Boolean(a.self),
    }));
  return {
    description: htmlToText(e.description),
    location: str(e.location),
    meeting,
    // A personal event's organizer is just the calendar itself: not worth showing.
    organizer: attendees.length ? organizer : null,
    attendees,
    attachments: (e.attachments ?? [])
      .map((a) => ({ title: str(a.title) ?? "Attachment", url: safeUrl(a.fileUrl) ?? "" }))
      .filter((a) => a.url),
    recurring: Boolean(e.recurringEventId),
    showAs: e.transparency === "transparent" ? "free" : "busy",
    visibility: str(e.visibility),
    edit: googleEditInfo(e, ctx, Boolean(meeting)),
  };
}

function googleEditInfo(
  e: GoogleDetailEvent,
  ctx: { calendarId?: string; writable?: boolean },
  hasMeeting: boolean
): ExternalEventEditInfo {
  const writable = ctx.writable !== false;
  const organizer = e.organizer;
  const ownEvent =
    !organizer || Boolean(organizer.self) || Boolean(ctx.calendarId && organizer.email === ctx.calendarId) || Boolean(e.guestsCanModify);
  const blocked = Boolean(e.locked) || e.eventType === "birthday" || e.eventType === "fromGmail";
  const canEdit = writable && ownEvent && !blocked;
  if (!canEdit) return { ...NO_EDIT };
  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  return {
    canEdit,
    allDay,
    start: allDay ? e.start?.date ?? null : e.start?.dateTime ? new Date(e.start.dateTime).toISOString() : null,
    end: allDay ? e.end?.date ?? null : e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : null,
    canAddMeeting: !hasMeeting,
    canRemoveMeeting: hasMeeting,
    canChooseNotify: true,
  };
}

// ── Outlook ────────────────────────────────────────────────────────────────

type OutlookDetailEvent = {
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
  location?: { displayName?: string };
  locations?: { displayName?: string }[];
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: { joinUrl?: string; tollNumber?: string; conferenceId?: string } | null;
  onlineMeetingUrl?: string | null;
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: {
    type?: string;
    status?: { response?: string };
    emailAddress?: { name?: string; address?: string };
  }[];
  seriesMasterId?: string | null;
  type?: string;
  showAs?: string;
  sensitivity?: string;
  isOrganizer?: boolean;
  isAllDay?: boolean;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
};

/** Graph UTC wall time ("2026-11-25T19:00:00.0000000", no suffix) → ISO instant. */
export function graphUtcToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const OUTLOOK_RESPONSE: Record<string, string> = {
  accepted: "accepted",
  declined: "declined",
  tentativelyAccepted: "tentative",
  notResponded: "needsAction",
  none: "needsAction",
  organizer: "organizer",
};

export function outlookEventDetails(
  e: OutlookDetailEvent,
  ctx: { calendarCanEdit?: boolean; meetingProvider?: string | null } = {}
): ExternalEventDetails {
  const joinUrl = safeUrl(e.onlineMeeting?.joinUrl) ?? safeUrl(e.onlineMeetingUrl);
  const provider = e.onlineMeetingProvider;
  const label =
    provider === "teamsForBusiness" || /teams\.microsoft\.com/.test(joinUrl ?? "")
      ? "Join Microsoft Teams"
      : provider === "skypeForBusiness" || provider === "skypeForConsumer"
        ? "Join Skype"
        : /zoom\.us/.test(joinUrl ?? "")
          ? "Join Zoom"
          : "Join video call";
  const organizerEmail = str(e.organizer?.emailAddress?.address);
  const attendees: ExternalEventPerson[] = (e.attendees ?? [])
    .filter((a) => a.type !== "resource")
    .slice(0, MAX_ATTENDEES)
    .map((a) => {
      const email = str(a.emailAddress?.address);
      const isOrganizer = Boolean(email && organizerEmail && email.toLowerCase() === organizerEmail.toLowerCase());
      return {
        name: str(a.emailAddress?.name),
        email,
        response: isOrganizer ? "organizer" : OUTLOOK_RESPONSE[a.status?.response ?? ""] ?? null,
        organizer: isOrganizer,
        optional: a.type === "optional",
        self: false,
      };
    });
  const raw = e.body?.content ?? e.bodyPreview ?? "";
  const location =
    str(e.location?.displayName) ??
    ((e.locations ?? []).map((l) => str(l.displayName)).filter(Boolean).join("; ") || null);
  return {
    description: htmlToText(raw),
    // Teams events put "Microsoft Teams Meeting" in the location: the join button covers it.
    location: location && joinUrl && /^microsoft teams meeting$/i.test(location) ? null : location,
    meeting: joinUrl
      ? {
          url: joinUrl,
          label,
          phone:
            [str(e.onlineMeeting?.tollNumber), e.onlineMeeting?.conferenceId ? `ID ${e.onlineMeeting.conferenceId}` : null]
              .filter(Boolean)
              .join(" · ") || null,
        }
      : null,
    organizer:
      attendees.length && e.organizer?.emailAddress
        ? { name: str(e.organizer.emailAddress.name), email: organizerEmail }
        : null,
    attendees,
    attachments: [],
    recurring: Boolean(e.seriesMasterId) || e.type === "occurrence" || e.type === "exception",
    showAs: str(e.showAs),
    visibility: e.sensitivity && e.sensitivity !== "normal" ? e.sensitivity : null,
    edit: outlookEditInfo(e, ctx, Boolean(joinUrl)),
  };
}

function outlookEditInfo(
  e: OutlookDetailEvent,
  ctx: { calendarCanEdit?: boolean; meetingProvider?: string | null },
  hasMeeting: boolean
): ExternalEventEditInfo {
  const canEdit = ctx.calendarCanEdit !== false && e.isOrganizer !== false;
  if (!canEdit) return { ...NO_EDIT };
  const allDay = Boolean(e.isAllDay);
  const start = graphUtcToIso(e.start?.dateTime);
  const end = graphUtcToIso(e.end?.dateTime);
  return {
    canEdit,
    allDay,
    // All-day events come back as midnight-to-midnight; the date part is the calendar date.
    start: allDay ? (e.start?.dateTime ?? "").slice(0, 10) || null : start,
    end: allDay ? (e.end?.dateTime ?? "").slice(0, 10) || null : end,
    canAddMeeting: !hasMeeting && Boolean(ctx.meetingProvider && ctx.meetingProvider !== "unknown"),
    // Microsoft doesn't allow turning an online meeting off once it exists.
    canRemoveMeeting: false,
    canChooseNotify: false,
  };
}

// ── Updates (shared by Google and Outlook) ─────────────────────────────────

export type ExternalEventUpdate = {
  scope: "this" | "all";
  notify: boolean;
  title?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  /** ISO instants, or YYYY-MM-DD (end exclusive) when allDay. */
  start?: string;
  end?: string;
  attendees?: { email: string; optional: boolean }[];
  meeting?: "add" | "remove";
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const MAX_EVENT_MS = 31 * 86_400_000;

/** Validates a PATCH body. Throws a user-facing message. */
export function parseExternalEventUpdate(body: Record<string, unknown>): ExternalEventUpdate {
  const out: ExternalEventUpdate = {
    scope: body.scope === "all" ? "all" : "this",
    notify: body.notify !== false,
  };
  const text = (key: string, max: number) => {
    if (!(key in body)) return undefined;
    const v = body[key];
    if (v !== null && typeof v !== "string") throw new Error(`Invalid ${key}.`);
    return (v ?? "").slice(0, max);
  };
  out.title = text("title", 500);
  out.description = text("description", MAX_DESCRIPTION);
  out.location = text("location", 1000);
  if ("start" in body || "end" in body) {
    const start = typeof body.start === "string" ? body.start : "";
    const end = typeof body.end === "string" ? body.end : "";
    const allDay = body.allDay === true;
    if (allDay) {
      if (!DATE_RE.test(start) || !DATE_RE.test(end)) throw new Error("Choose the event's dates.");
      if (end <= start) throw new Error("The end date must be after the start date.");
      if (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > MAX_EVENT_MS) throw new Error("Events can be at most 31 days long.");
      out.start = start;
      out.end = end;
    } else {
      const s = Date.parse(start);
      const e = Date.parse(end);
      if (!Number.isFinite(s) || !Number.isFinite(e)) throw new Error("Choose a start and end time.");
      if (e <= s) throw new Error("The end time must be after the start time.");
      if (e - s > MAX_EVENT_MS) throw new Error("Events can be at most 31 days long.");
      out.start = new Date(s).toISOString();
      out.end = new Date(e).toISOString();
    }
    out.allDay = allDay;
  }
  if ("attendees" in body) {
    if (!Array.isArray(body.attendees)) throw new Error("Invalid guests.");
    const seen = new Set<string>();
    out.attendees = [];
    for (const raw of body.attendees.slice(0, MAX_ATTENDEES)) {
      const a = raw as { email?: unknown; optional?: unknown };
      const email = typeof a?.email === "string" ? a.email.trim() : "";
      if (!EMAIL_RE.test(email)) throw new Error(`"${email.slice(0, 80)}" isn't a valid email address.`);
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.attendees.push({ email, optional: a.optional === true });
    }
  }
  if (body.meeting === "add" || body.meeting === "remove") out.meeting = body.meeting;
  return out;
}

/**
 * New guest list from the edited one. Existing guests keep everything the provider knows about
 * them (replies, organizer/self flags); rooms and resources the editor never shows are kept.
 */
export function mergeGoogleAttendees<T extends { email?: string; resource?: boolean; optional?: boolean; organizer?: boolean }>(
  existing: T[] | undefined,
  requested: { email: string; optional: boolean }[]
): Array<T | { email: string; optional?: boolean }> {
  const byEmail = new Map((existing ?? []).filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a]));
  const out: Array<T | { email: string; optional?: boolean }> = [];
  const wanted = new Set(requested.map((r) => r.email.toLowerCase()));
  for (const r of requested) {
    const prior = byEmail.get(r.email.toLowerCase());
    if (prior) out.push({ ...prior, optional: r.optional || undefined });
    else out.push(r.optional ? { email: r.email, optional: true } : { email: r.email });
  }
  for (const a of existing ?? []) {
    const key = a.email?.toLowerCase();
    // Rooms, and the organizer (Google always keeps them), stay even if not in the edited list.
    if ((a.resource || a.organizer) && (!key || !wanted.has(key))) out.push(a);
  }
  return out;
}

type GraphAttendee = { type?: string; emailAddress?: { name?: string; address?: string } };

export function mergeOutlookAttendees(
  existing: GraphAttendee[] | undefined,
  requested: { email: string; optional: boolean }[]
): { type: string; emailAddress: { address: string; name?: string } }[] {
  const byEmail = new Map(
    (existing ?? []).filter((a) => a.emailAddress?.address).map((a) => [a.emailAddress!.address!.toLowerCase(), a])
  );
  const wanted = new Set(requested.map((r) => r.email.toLowerCase()));
  const out: { type: string; emailAddress: { address: string; name?: string } }[] = requested.map((r) => {
    const prior = byEmail.get(r.email.toLowerCase());
    return {
      type: r.optional ? "optional" : "required",
      emailAddress: { address: prior?.emailAddress?.address ?? r.email, ...(prior?.emailAddress?.name ? { name: prior.emailAddress.name } : {}) },
    };
  });
  for (const a of existing ?? []) {
    const key = a.emailAddress?.address?.toLowerCase();
    if (a.type === "resource" && key && !wanted.has(key)) {
      out.push({ type: "resource", emailAddress: { address: a.emailAddress!.address!, ...(a.emailAddress?.name ? { name: a.emailAddress.name } : {}) } });
    }
  }
  return out;
}

/**
 * "All events" time change for a repeating event: the series start moves by the same amount as
 * this occurrence, and takes its new length. Moving a series to another day isn't supported
 * (callers check the day first) — recurrence rules are tied to the weekday.
 */
export function shiftSeriesTimes(
  seriesStartIso: string,
  occurrenceStartIso: string,
  newStartIso: string,
  newEndIso: string
): { start: string; end: string } {
  const delta = Date.parse(newStartIso) - Date.parse(occurrenceStartIso);
  const length = Date.parse(newEndIso) - Date.parse(newStartIso);
  const start = Date.parse(seriesStartIso) + delta;
  return { start: new Date(start).toISOString(), end: new Date(start + length).toISOString() };
}

/** YYYY-MM-DD + n days. */
export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
