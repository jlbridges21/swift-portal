/**
 * Google Calendar — per-business OAuth, ShootPortal → Google push, and a live
 * owner-only pull of external events. Event bodies are not stored.
 *
 * OAuth client is GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET.
 * Do not reuse the Supabase Auth Google client (different scopes and consent).
 *
 * Redirect URI is always https://{PLATFORM_ROOT_DOMAIN}/api/integrations/google-calendar/callback
 * (shootportal.app). The browser is sent back to the tenant portal origin afterward.
 * The Supabase session never lives on the apex, so this is a signed return — not a
 * new auth_session_handoffs mint.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { isPlatformApexHostname } from "@/lib/portal-url";
import { decryptCalendarSecret, encryptCalendarSecret } from "@/lib/google-calendar-crypto";
import {
  listGoogleEvents,
  resolveReadCalendarIds,
  validateReadCalendarSelection,
  type ExternalCalendarEvent,
} from "@/lib/google-calendar-pull";

export const GOOGLE_CALENDAR_SCOPES = [
  // Create, update, delete, and read events. Narrower than full `calendar`
  // (which also manages calendar ACLs and settings).
  "https://www.googleapis.com/auth/calendar.events",
  // Read the calendar list so the owner can choose which calendar we write to.
  // Cannot create or delete calendars.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

const DEFAULT_TIMEZONE = "America/New_York";
const EVENT_DURATION_MS = 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleCalendarPublicStatus = {
  configured: boolean;
  connected: boolean;
  status: "disconnected" | "active" | "needs_reconnect";
  email: string | null;
  calendarId: string | null;
  calendarSummary: string | null;
  lastError: string | null;
  attentionCount: number;
  calendars: { id: string; summary: string; primary: boolean }[];
  /** Calendars pulled onto the owner calendar. Independent of calendarId. */
  readCalendarIds: string[];
};

type ConnectionRow = {
  business_id: string;
  connected_email: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string | null;
  calendar_id: string;
  calendar_summary: string | null;
  read_calendar_ids: string[] | null;
  read_sync_tokens: Record<string, string> | null;
  status: "active" | "needs_reconnect";
  last_error: string | null;
};

type TokenBundle = { accessToken: string; refreshToken: string; expiresAt: string | null };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function clientId(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || "";
}
function clientSecret(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || "";
}

export function googleCalendarConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

/** Exact redirect URI to register in Google Cloud. Never a tenant host. */
export function googleCalendarRedirectUri(): string {
  const override = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (override) return override;
  return `https://${getPlatformRootDomain()}/api/integrations/google-calendar/callback`;
}

export function isGoogleCalendarCallbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  const root = getPlatformRootDomain().toLowerCase();
  return host === root || host === `www.${root}`;
}

function stateSecret(): string {
  const secret = clientSecret() || process.env.PLATFORM_SESSION_SECRET?.trim() || "";
  if (!secret) throw new Error("Google Calendar OAuth is not configured.");
  return secret;
}

type OAuthState = {
  businessId: string;
  userId: string;
  returnOrigin: string;
  exp: number;
  nonce: string;
};

export function signOAuthState(payload: Omit<OAuthState, "exp" | "nonce"> & { exp?: number }): string {
  const body: OAuthState = {
    businessId: payload.businessId,
    userId: payload.userId,
    returnOrigin: payload.returnOrigin,
    exp: payload.exp ?? Date.now() + STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const data = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OAuthState;
    if (!parsed.businessId || !parsed.userId || !parsed.returnOrigin || !parsed.exp) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function googleAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", googleCalendarRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Send the browser back to the portal they started on.
 * Apex (shootportal.app / www) is replaced with the business portal origin.
 * Any other host that is not the business portal is replaced the same way.
 */
export function resolveGoogleCalendarReturnUrl(args: {
  returnOrigin: string;
  businessPortalOrigin: string;
  path?: string;
}): string {
  const path = args.path || "/admin/settings?gcal=connected#settings-integrations";
  let origin = args.businessPortalOrigin;
  try {
    const requested = new URL(args.returnOrigin);
    const portal = new URL(args.businessPortalOrigin);
    if (!isPlatformApexHostname(requested.hostname) && requested.origin === portal.origin) {
      origin = portal.origin;
    } else if (!isPlatformApexHostname(requested.hostname) && requested.origin !== portal.origin) {
      origin = portal.origin;
    }
  } catch {
    origin = args.businessPortalOrigin;
  }
  const base = origin.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function redact(message: string): string {
  return message.replace(/ya29\.[A-Za-z0-9_\-]+/g, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);
}

async function readConnection(businessId: string): Promise<ConnectionRow | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("google_calendar_connections")
    .select(
      "business_id, connected_email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, calendar_id, calendar_summary, read_calendar_ids, read_sync_tokens, status, last_error"
    )
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

function bundleFromRow(row: ConnectionRow): TokenBundle {
  return {
    accessToken: decryptCalendarSecret(row.access_token_ciphertext),
    refreshToken: decryptCalendarSecret(row.refresh_token_ciphertext),
    expiresAt: row.token_expires_at,
  };
}

async function saveTokens(
  businessId: string,
  tokens: TokenBundle,
  patch: Partial<
    Pick<
      ConnectionRow,
      "connected_email" | "calendar_id" | "calendar_summary" | "status" | "last_error" | "read_calendar_ids" | "read_sync_tokens"
    >
  > & {
    connectedBy?: string | null;
  }
) {
  const db = await createTenantServiceClient(businessId);
  const row: Record<string, unknown> = {
    connected_email: patch.connected_email ?? null,
    access_token_ciphertext: encryptCalendarSecret(tokens.accessToken),
    refresh_token_ciphertext: encryptCalendarSecret(tokens.refreshToken),
    token_expires_at: tokens.expiresAt,
    calendar_id: patch.calendar_id || "primary",
    calendar_summary: patch.calendar_summary ?? null,
    status: patch.status ?? "active",
    last_error: patch.last_error ?? null,
  };
  if (patch.read_calendar_ids) row.read_calendar_ids = patch.read_calendar_ids;
  if (patch.read_sync_tokens) row.read_sync_tokens = patch.read_sync_tokens;
  if (patch.connectedBy) row.connected_by = patch.connectedBy;
  const { error } = await db.from("google_calendar_connections").upsert(row);
  if (error) throw new Error(redact(error.message));
}

export async function exchangeAuthCode(
  code: string,
  transport: FetchLike = fetch
): Promise<TokenBundle & { email: string | null }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: googleCalendarRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await transport("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(redact(json.error || "Google token exchange failed"));
  }
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : null;
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt, email: null };
}

export async function refreshAccessToken(
  refreshToken: string,
  transport: FetchLike = fetch
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await transport("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    const err = new Error(redact(json.error || "refresh_failed"));
    (err as Error & { code?: string }).code = json.error || "refresh_failed";
    throw err;
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null,
  };
}

export async function revokeGoogleToken(
  token: string,
  transport: FetchLike = fetch
): Promise<{ ok: boolean; status: number }> {
  const res = await transport("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  return { ok: res.ok, status: res.status };
}

export async function listWritableCalendars(
  accessToken: string,
  transport: FetchLike = fetch
): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const res = await transport(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(redact(text || `calendarList ${res.status}`));
  }
  const json = (await res.json()) as {
    items?: { id?: string; summary?: string; primary?: boolean; accessRole?: string }[];
  };
  return (json.items ?? [])
    .filter((c) => c.id && (c.accessRole === "owner" || c.accessRole === "writer"))
    .map((c) => ({
      id: c.id as string,
      summary: c.summary || c.id || "Calendar",
      primary: Boolean(c.primary),
    }));
}

async function markNeedsReconnect(businessId: string, message: string) {
  const db = await createTenantServiceClient(businessId);
  await db
    .from("google_calendar_connections")
    .update({ status: "needs_reconnect", last_error: redact(message) })
    .eq("business_id", businessId);
}

async function accessTokenFor(businessId: string, transport: FetchLike): Promise<
  | { ok: true; token: string; calendarId: string; row: ConnectionRow }
  | { ok: false; error: string }
> {
  const row = await readConnection(businessId);
  if (!row) return { ok: false, error: "not_connected" };
  if (row.status === "needs_reconnect") {
    return { ok: false, error: row.last_error || "Google Calendar needs to be reconnected." };
  }
  let bundle = bundleFromRow(row);
  const exp = bundle.expiresAt ? Date.parse(bundle.expiresAt) : 0;
  if (!exp || exp < Date.now() + 60_000) {
    try {
      bundle = await refreshAccessToken(bundle.refreshToken, transport);
      await saveTokens(businessId, bundle, {
        connected_email: row.connected_email,
        calendar_id: row.calendar_id,
        calendar_summary: row.calendar_summary,
        status: "active",
        last_error: null,
        connectedBy: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "refresh_failed";
      await markNeedsReconnect(businessId, message);
      return { ok: false, error: "Google Calendar needs to be reconnected." };
    }
  }
  return { ok: true, token: bundle.accessToken, calendarId: row.calendar_id || "primary", row };
}

export function resolveBusinessTimeZone(raw: string | null | undefined): {
  timeZone: string;
  usedFallback: boolean;
} {
  const zone = (raw || "").trim();
  if (!zone) return { timeZone: DEFAULT_TIMEZONE, usedFallback: true };
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return { timeZone: zone, usedFallback: false };
  } catch {
    return { timeZone: DEFAULT_TIMEZONE, usedFallback: true };
  }
}

export function formatGoogleDateTime(instantIso: string, timeZone: string): string {
  const d = new Date(instantIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

export function shootIcalUid(proposalId: string): string {
  return `${proposalId}@shootportal.app`;
}

export type GoogleEventDraft = {
  proposalId: string;
  calendarId: string;
  existingEventId: string | null;
  summary: string;
  description: string;
  startIso: string;
  timeZone: string;
};

export async function upsertGoogleEvent(
  accessToken: string,
  draft: GoogleEventDraft,
  transport: FetchLike = fetch
): Promise<{ eventId: string; created: boolean; htmlLink: string | null }> {
  const endIso = new Date(Date.parse(draft.startIso) + EVENT_DURATION_MS).toISOString();
  const body = {
    summary: draft.summary,
    description: draft.description,
    iCalUID: shootIcalUid(draft.proposalId),
    start: { dateTime: formatGoogleDateTime(draft.startIso, draft.timeZone), timeZone: draft.timeZone },
    end: { dateTime: formatGoogleDateTime(endIso, draft.timeZone), timeZone: draft.timeZone },
    extendedProperties: { private: { shootPortalProposalId: draft.proposalId } },
  };
  const cal = encodeURIComponent(draft.calendarId || "primary");
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  if (draft.existingEventId) {
    const res = await transport(
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${encodeURIComponent(draft.existingEventId)}`,
      { method: "PATCH", headers, body: JSON.stringify(body) }
    );
    if (res.ok) {
      const json = (await res.json()) as { id?: string; htmlLink?: string };
      return { eventId: json.id || draft.existingEventId, created: false, htmlLink: json.htmlLink ?? null };
    }
    if (res.status !== 404 && res.status !== 410) {
      throw new Error(redact(await res.text()));
    }
  }

  const insert = await transport(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (insert.status === 409) {
    const found = await transport(
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?iCalUID=${encodeURIComponent(shootIcalUid(draft.proposalId))}&maxResults=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!found.ok) throw new Error(redact(await found.text()));
    const json = (await found.json()) as { items?: { id?: string; htmlLink?: string }[] };
    const existing = json.items?.[0];
    if (!existing?.id) throw new Error("Google reported a duplicate event but it could not be found.");
    const patch = await transport(
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${encodeURIComponent(existing.id)}`,
      { method: "PATCH", headers, body: JSON.stringify(body) }
    );
    if (!patch.ok) throw new Error(redact(await patch.text()));
    const patched = (await patch.json()) as { id?: string; htmlLink?: string };
    return { eventId: patched.id || existing.id, created: false, htmlLink: patched.htmlLink ?? existing.htmlLink ?? null };
  }
  if (!insert.ok) throw new Error(redact(await insert.text()));
  const created = (await insert.json()) as { id?: string; htmlLink?: string };
  if (!created.id) throw new Error("Google did not return an event id.");
  return { eventId: created.id, created: true, htmlLink: created.htmlLink ?? null };
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  transport: FetchLike = fetch
): Promise<void> {
  const res = await transport(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(redact(await res.text()));
  }
}

async function setSync(
  businessId: string,
  proposalId: string,
  patch: { google_event_id?: string | null; google_sync_status: string; google_sync_error: string | null }
) {
  const db = await createTenantServiceClient(businessId);
  await db
    .from("shoot_proposals")
    .update({ ...patch, google_sync_at: new Date().toISOString() })
    .eq("id", proposalId);
}

export async function pushConfirmedShoot(
  businessId: string,
  proposalId: string,
  transport: FetchLike = fetch
): Promise<{ ok: true; eventId: string; created: boolean } | { ok: false; error: string }> {
  if (process.env.GOOGLE_CALENDAR_FORCE_FAIL === "1") {
    await setSync(businessId, proposalId, {
      google_sync_status: "error",
      google_sync_error: "Google Calendar sync was forced to fail.",
    });
    return { ok: false, error: "forced_fail" };
  }
  const db = await createTenantServiceClient(businessId);
  const { data: proposal } = await db
    .from("shoot_proposals")
    .select("id, project_id, proposed_at, status, google_event_id, projects(project_name, property_address, clients(name))")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { ok: false, error: "not_found" };
  if (proposal.status !== "confirmed") {
    if (proposal.google_event_id) {
      return removeShootEvent(businessId, proposalId, transport);
    }
    return { ok: false, error: "not_confirmed" };
  }

  const auth = await accessTokenFor(businessId, transport);
  if (!auth.ok) {
    if (auth.error === "not_connected") return { ok: false, error: auth.error };
    await setSync(businessId, proposalId, {
      google_sync_status: "error",
      google_sync_error: auth.error,
    });
    return { ok: false, error: auth.error };
  }

  const settings = await getAppSettings(businessId);
  const tz = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone);
  const project = proposal.projects as unknown as {
    project_name?: string;
    property_address?: string;
    clients?: { name?: string } | null;
  } | null;
  const summary = project?.project_name || "Shoot";
  const description = [
    project?.clients?.name ? `Client: ${project.clients.name}` : null,
    project?.property_address ? `Address: ${project.property_address}` : null,
    "Scheduled in ShootPortal (1 hour).",
    tz.usedFallback ? `Timezone fell back to ${tz.timeZone} because the business timezone was unset or invalid.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await upsertGoogleEvent(
      auth.token,
      {
        proposalId,
        calendarId: auth.calendarId,
        existingEventId: proposal.google_event_id,
        summary,
        description,
        startIso: proposal.proposed_at,
        timeZone: tz.timeZone,
      },
      transport
    );
    await setSync(businessId, proposalId, {
      google_event_id: result.eventId,
      google_sync_status: "synced",
      google_sync_error: null,
    });
    return { ok: true, eventId: result.eventId, created: result.created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Calendar sync failed";
    await setSync(businessId, proposalId, {
      google_sync_status: "error",
      google_sync_error: redact(message),
    });
    return { ok: false, error: message };
  }
}

export async function removeShootEvent(
  businessId: string,
  proposalId: string,
  transport: FetchLike = fetch
): Promise<{ ok: true; eventId: string; created: boolean } | { ok: false; error: string }> {
  const db = await createTenantServiceClient(businessId);
  const { data: proposal } = await db
    .from("shoot_proposals")
    .select("id, google_event_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal?.google_event_id) return { ok: false, error: "no_event" };
  const auth = await accessTokenFor(businessId, transport);
  if (!auth.ok) {
    await setSync(businessId, proposalId, {
      google_sync_status: "error",
      google_sync_error: auth.error === "not_connected" ? "Not connected" : auth.error,
    });
    return { ok: false, error: auth.error };
  }
  try {
    await deleteGoogleEvent(auth.token, auth.calendarId, proposal.google_event_id, transport);
    await setSync(businessId, proposalId, {
      google_event_id: null,
      google_sync_status: "synced",
      google_sync_error: null,
    });
    return { ok: true, eventId: proposal.google_event_id, created: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Calendar delete failed";
    await setSync(businessId, proposalId, {
      google_sync_status: "error",
      google_sync_error: redact(message),
    });
    return { ok: false, error: message };
  }
}

/** Never throws. Shoot writes must succeed even when Google is down. */
export async function syncShootToGoogleSafe(
  businessId: string,
  proposalId: string,
  mode: "upsert" | "delete"
): Promise<void> {
  try {
    if (mode === "delete") await removeShootEvent(businessId, proposalId);
    else await pushConfirmedShoot(businessId, proposalId);
  } catch (err) {
    console.error("[google-calendar] sync failed", {
      businessId,
      proposalId,
      mode,
      error: err instanceof Error ? redact(err.message) : "unknown",
    });
  }
}

export async function retryAttentionSyncs(businessId: string): Promise<number> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("shoot_proposals")
    .select("id, status")
    .eq("google_sync_status", "error")
    .limit(8);
  let n = 0;
  for (const row of data ?? []) {
    if (row.status === "confirmed") await pushConfirmedShoot(businessId, row.id);
    else await removeShootEvent(businessId, row.id);
    n += 1;
  }
  return n;
}

export async function getGoogleCalendarPublicStatus(businessId: string): Promise<GoogleCalendarPublicStatus> {
  const empty: GoogleCalendarPublicStatus = {
    configured: googleCalendarConfigured(),
    connected: false,
    status: "disconnected",
    email: null,
    calendarId: null,
    calendarSummary: null,
    lastError: null,
    attentionCount: 0,
    calendars: [],
    readCalendarIds: [],
  };
  const row = await readConnection(businessId);
  const db = await createTenantServiceClient(businessId);
  const { count } = await db
    .from("shoot_proposals")
    .select("id", { count: "exact", head: true })
    .eq("google_sync_status", "error");
  if (!row) return { ...empty, attentionCount: count ?? 0 };

  let calendars: GoogleCalendarPublicStatus["calendars"] = [];
  if (row.status === "active") {
    try {
      const auth = await accessTokenFor(businessId, fetch);
      if (auth.ok) calendars = await listWritableCalendars(auth.token);
    } catch {
      calendars = [];
    }
  }
  const fresh = (await readConnection(businessId)) ?? row;
  return {
    configured: googleCalendarConfigured(),
    connected: fresh.status === "active",
    status: fresh.status,
    email: fresh.connected_email,
    calendarId: fresh.calendar_id,
    calendarSummary: fresh.calendar_summary,
    lastError: fresh.last_error,
    attentionCount: count ?? 0,
    calendars,
    readCalendarIds: resolveReadCalendarIds(fresh.read_calendar_ids, fresh.calendar_id),
  };
}

export async function completeGoogleCalendarConnect(args: {
  businessId: string;
  userId: string;
  code: string;
}): Promise<void> {
  const tokens = await exchangeAuthCode(args.code);
  const calendars = await listWritableCalendars(tokens.accessToken);
  const primary = calendars.find((c) => c.primary) ?? calendars[0];
  const email =
    primary?.id?.includes("@") ? primary.id : calendars.find((c) => c.id.includes("@"))?.id ?? null;
  await saveTokens(
    args.businessId,
    tokens,
    {
      connected_email: email,
      calendar_id: primary?.id || "primary",
      calendar_summary: primary?.summary || "Primary",
      read_calendar_ids: [primary?.id || "primary"],
      read_sync_tokens: {},
      status: "active",
      last_error: null,
      connectedBy: args.userId,
    }
  );
}

export async function updateSelectedCalendar(
  businessId: string,
  calendarId: string
): Promise<{ calendarId: string; calendarSummary: string }> {
  const auth = await accessTokenFor(businessId, fetch);
  if (!auth.ok) throw new Error(auth.error);
  const calendars = await listWritableCalendars(auth.token);
  const match = calendars.find((c) => c.id === calendarId);
  if (!match) throw new Error("That calendar is not writable on the connected account.");
  const db = await createTenantServiceClient(businessId);
  const { error } = await db
    .from("google_calendar_connections")
    .update({ calendar_id: match.id, calendar_summary: match.summary, last_error: null })
    .eq("business_id", businessId);
  if (error) throw new Error(redact(error.message));
  return { calendarId: match.id, calendarSummary: match.summary };
}

/** Read selection is independent of the write target. Clears sync cursors for a clean next pull. */
export async function updateReadCalendars(
  businessId: string,
  calendarIds: string[]
): Promise<{ readCalendarIds: string[] }> {
  const auth = await accessTokenFor(businessId, fetch);
  if (!auth.ok) throw new Error(auth.error);
  const calendars = await listWritableCalendars(auth.token);
  const picked = validateReadCalendarSelection(
    calendarIds,
    calendars.map((c) => c.id)
  );
  if (!picked.length) throw new Error("Select at least one calendar to show.");
  const db = await createTenantServiceClient(businessId);
  const { error } = await db
    .from("google_calendar_connections")
    .update({ read_calendar_ids: picked, read_sync_tokens: {} })
    .eq("business_id", businessId);
  if (error) throw new Error(redact(error.message));
  return { readCalendarIds: picked };
}

/**
 * Live events for the owner calendar window. Never throws.
 * Does not use syncToken — a stale cursor must not blank the page.
 * 429 comes back as degraded with whatever events were collected.
 */
export async function loadExternalEventsForOwner(
  businessId: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: ExternalCalendarEvent[]; degraded: boolean; timeZone: string }> {
  try {
    const settings = await getAppSettings(businessId);
    const timeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
    const row = await readConnection(businessId);
    if (!row || row.status !== "active") return { events: [], degraded: false, timeZone };
    const auth = await accessTokenFor(businessId, fetch);
    if (!auth.ok) return { events: [], degraded: true, timeZone };
    const ids = resolveReadCalendarIds(row.read_calendar_ids, row.calendar_id);
    const summaries = new Map<string, string>();
    try {
      const calendars = await listWritableCalendars(auth.token);
      for (const calendar of calendars) summaries.set(calendar.id, calendar.summary);
    } catch {
      // Calendar names fall back to the id. The page still renders shoots.
    }
    const events: ExternalCalendarEvent[] = [];
    let degraded = false;
    for (const id of ids) {
      try {
        const result = await listGoogleEvents({
          accessToken: auth.token,
          calendarId: id,
          calendarSummary:
            summaries.get(id) || (id === row.calendar_id ? row.calendar_summary || id : id),
          timeZone,
          timeMin,
          timeMax,
          syncToken: null,
        });
        events.push(...result.events);
        if (result.degraded) degraded = true;
      } catch {
        degraded = true;
      }
    }
    events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    const capped = events.length > 500;
    return { events: capped ? events.slice(0, 500) : events, degraded: degraded || capped, timeZone };
  } catch {
    return { events: [], degraded: true, timeZone: DEFAULT_TIMEZONE };
  }
}

/**
 * Daily cursor refresh. Stores nextSyncToken only — not event bodies.
 * 410 drops the cursor and takes a fresh one from a full window list.
 */
export async function pollGoogleCalendarSync(businessId: string): Promise<{
  skipped: boolean;
  calendars: number;
  resynced: number;
  degraded: boolean;
}> {
  const quiet = { skipped: true, calendars: 0, resynced: 0, degraded: false };
  try {
    const row = await readConnection(businessId);
    if (!row || row.status !== "active") return quiet;
    const auth = await accessTokenFor(businessId, fetch);
    if (!auth.ok) return { ...quiet, degraded: true };
    const settings = await getAppSettings(businessId);
    const timeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
    const ids = resolveReadCalendarIds(row.read_calendar_ids, row.calendar_id);
    const tokens: Record<string, string> = { ...(row.read_sync_tokens || {}) };
    const now = Date.now();
    const timeMin = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now + 80 * 24 * 60 * 60 * 1000).toISOString();
    let resynced = 0;
    let degraded = false;
    for (const id of ids) {
      try {
        const result = await listGoogleEvents({
          accessToken: auth.token,
          calendarId: id,
          calendarSummary: id,
          timeZone,
          timeMin,
          timeMax,
          syncToken: tokens[id] || null,
        });
        if (result.resynced) resynced += 1;
        if (result.degraded) degraded = true;
        if (!result.degraded && result.nextSyncToken) tokens[id] = result.nextSyncToken;
        else if (result.resynced) delete tokens[id];
      } catch {
        degraded = true;
      }
    }
    const kept: Record<string, string> = {};
    for (const id of ids) {
      if (tokens[id]) kept[id] = tokens[id];
    }
    const db = await createTenantServiceClient(businessId);
    await db.from("google_calendar_connections").update({ read_sync_tokens: kept }).eq("business_id", businessId);
    return { skipped: false, calendars: ids.length, resynced, degraded };
  } catch {
    return { skipped: false, calendars: 0, resynced: 0, degraded: true };
  }
}

export async function disconnectGoogleCalendar(businessId: string): Promise<{
  revoked: boolean;
  revokeStatus: number | null;
}> {
  const row = await readConnection(businessId);
  let revoked = false;
  let revokeStatus: number | null = null;
  if (row) {
    try {
      const refresh = decryptCalendarSecret(row.refresh_token_ciphertext);
      const result = await revokeGoogleToken(refresh);
      revoked = result.ok;
      revokeStatus = result.status;
    } catch {
      revoked = false;
    }
  }
  const db = await createTenantServiceClient(businessId);
  await db.from("google_calendar_connections").delete().eq("business_id", businessId);
  return { revoked, revokeStatus };
}
