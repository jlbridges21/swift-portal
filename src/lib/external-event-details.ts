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
};

export function googleEventDetails(e: GoogleDetailEvent): ExternalEventDetails {
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
};

const OUTLOOK_RESPONSE: Record<string, string> = {
  accepted: "accepted",
  declined: "declined",
  tentativelyAccepted: "tentative",
  notResponded: "needsAction",
  none: "needsAction",
  organizer: "organizer",
};

export function outlookEventDetails(e: OutlookDetailEvent): ExternalEventDetails {
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
  };
}
