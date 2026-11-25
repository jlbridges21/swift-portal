/**
 * Outlook / Microsoft 365 calendar — per-business OAuth (Microsoft identity platform v2),
 * ShootPortal → Outlook push of shoots, and Outlook busy times for Instant Booking.
 *
 * Fully separate from Google Calendar (lib/google-calendar.ts): its own tables (migration v137),
 * its own OAuth client, its own routes. A business may connect Google, Outlook, or both. Every
 * Outlook call is best-effort and never throws into the shoot / booking flows.
 *
 * Env: MICROSOFT_CALENDAR_CLIENT_ID, MICROSOFT_CALENDAR_CLIENT_SECRET
 *      (optional) MICROSOFT_CALENDAR_TENANT  — default "common" (work/school + personal accounts)
 *      (optional) MICROSOFT_CALENDAR_REDIRECT_URI
 *
 * Redirect URI: https://www.{PLATFORM_ROOT_DOMAIN}/api/integrations/outlook-calendar/callback.
 * The browser is sent back to the tenant portal afterwards via a signed state (same model as
 * Google Calendar).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { buildEventText } from "@/lib/booking/event-template";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";
import { toExternalEvent, type ExternalCalendarEvent } from "@/lib/google-calendar-pull";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Delegated Graph permissions. offline_access = refresh token; User.Read = the account email. */
export const OUTLOOK_CALENDAR_SCOPES = ["offline_access", "openid", "email", "User.Read", "Calendars.ReadWrite"] as const;

const GRAPH = "https://graph.microsoft.com/v1.0";
const STATE_TTL_MS = 10 * 60 * 1000;
const EVENT_DURATION_MS = 60 * 60 * 1000;
const GRAPH_TIMEOUT_MS = 8_000;
const TOKEN_PURPOSE = "sp-outlook-token";
const TOKEN_WHAT = "Outlook Calendar tokens";

export type OutlookCalendar = { id: string; name: string; isDefault: boolean; canEdit: boolean; color: string | null };

export type OutlookCalendarPublicStatus = {
  configured: boolean;
  /** False until migration v137 is applied. */
  schemaReady: boolean;
  connected: boolean;
  status: "disconnected" | "active" | "needs_reconnect";
  email: string | null;
  calendarId: string | null;
  calendarName: string | null;
  busyCalendarIds: string[];
  lastError: string | null;
  attentionCount: number;
  calendars: OutlookCalendar[];
};

type ConnectionRow = {
  business_id: string;
  connected_email: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  busy_calendar_ids: string[] | null;
  status: "active" | "needs_reconnect";
  last_error: string | null;
};

type TokenBundle = { accessToken: string; refreshToken: string; expiresAt: string | null };

// ── config ──────────────────────────────────────────────────────────────────

function clientId(): string {
  return process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim() || "";
}
function clientSecret(): string {
  return process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim() || "";
}
function authority(): string {
  const tenant = process.env.MICROSOFT_CALENDAR_TENANT?.trim() || "common";
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
}

export function outlookCalendarConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

/** Exact redirect URI to register in Microsoft Entra. Never a tenant host. */
export function outlookCalendarRedirectUri(): string {
  const override = process.env.MICROSOFT_CALENDAR_REDIRECT_URI?.trim();
  if (override) return override;
  return `https://www.${getPlatformRootDomain()}/api/integrations/outlook-calendar/callback`;
}

export function isOutlookCalendarCallbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  const root = getPlatformRootDomain().toLowerCase();
  if (host === root || host === `www.${root}`) return true;
  // A local override (MICROSOFT_CALENDAR_REDIRECT_URI=http://localhost:3000/...) for development.
  const override = process.env.MICROSOFT_CALENDAR_REDIRECT_URI?.trim();
  if (override && process.env.NODE_ENV !== "production") {
    try {
      return new URL(override).hostname.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  return false;
}

function redact(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function encrypt(value: string): string {
  if (!value) throw new Error("Refusing to encrypt an empty calendar secret.");
  return sealWithPurpose(TOKEN_PURPOSE, TOKEN_WHAT, Buffer.from(value, "utf8"));
}
function decrypt(value: string): string {
  return openWithPurpose(TOKEN_PURPOSE, TOKEN_WHAT, value).toString("utf8");
}

const timedFetch: FetchLike = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(GRAPH_TIMEOUT_MS) });

// ── OAuth state ─────────────────────────────────────────────────────────────

type OAuthState = {
  businessId: string;
  userId: string;
  returnOrigin: string;
  /** Admin page to land on after connecting (e.g. /admin/calendar). Defaults to Settings → Integrations. */
  returnPath?: string;
  exp: number;
  nonce: string;
};

/** Only same-portal admin paths, never another origin. */
export function safeOutlookReturnPath(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  const clean = path.split("#")[0].split("?")[0];
  if (!/^\/admin(\/[A-Za-z0-9_\-\/]*)?$/.test(clean) || clean.includes("//")) return undefined;
  return clean;
}

function stateSecret(): string {
  const secret = clientSecret() || process.env.PLATFORM_SESSION_SECRET?.trim() || "";
  if (!secret) throw new Error("Outlook Calendar OAuth is not configured.");
  return `outlook-calendar-state:${secret}`;
}

export function signOutlookOAuthState(payload: {
  businessId: string;
  userId: string;
  returnOrigin: string;
  returnPath?: string;
  exp?: number;
}): string {
  const body: OAuthState = {
    businessId: payload.businessId,
    userId: payload.userId,
    returnOrigin: payload.returnOrigin,
    ...(safeOutlookReturnPath(payload.returnPath) ? { returnPath: safeOutlookReturnPath(payload.returnPath) } : {}),
    exp: payload.exp ?? Date.now() + STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const data = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyOutlookOAuthState(state: string): OAuthState | null {
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

export function outlookAuthUrl(state: string): string {
  const url = new URL(`${authority()}/authorize`);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", outlookCalendarRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", OUTLOOK_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

// ── tokens ──────────────────────────────────────────────────────────────────

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>, transport: FetchLike): Promise<{ status: number; json: TokenResponse }> {
  const res = await transport(`${authority()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      scope: OUTLOOK_CALENDAR_SCOPES.join(" "),
      ...params,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  return { status: res.status, json };
}

function expiresAtFrom(json: TokenResponse): string | null {
  return json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
}

export async function exchangeOutlookAuthCode(code: string, transport: FetchLike = fetch): Promise<TokenBundle> {
  const { status, json } = await tokenRequest(
    { code, redirect_uri: outlookCalendarRedirectUri(), grant_type: "authorization_code" },
    transport
  );
  if (status >= 400 || !json.access_token || !json.refresh_token) {
    throw new Error(redact(json.error_description || json.error || "Microsoft token exchange failed"));
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: expiresAtFrom(json) };
}

/** Microsoft rotates refresh tokens: always store the one that comes back. */
export async function refreshOutlookAccessToken(refreshToken: string, transport: FetchLike = fetch): Promise<TokenBundle> {
  const { status, json } = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }, transport);
  if (status >= 400 || !json.access_token) {
    const err = new Error(redact(json.error_description || json.error || "refresh_failed")) as Error & { permanent?: boolean };
    // 400/401 (invalid_grant, consent revoked, password reset…) needs the owner; 5xx is transient.
    err.permanent = status === 400 || status === 401;
    throw err;
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: expiresAtFrom(json),
  };
}

// ── Graph ───────────────────────────────────────────────────────────────────

async function graph(
  token: string,
  path: string,
  init: RequestInit & { transport?: FetchLike } = {}
): Promise<Response> {
  const { transport = timedFetch, headers, ...rest } = init;
  const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
  return transport(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      // Times come back in UTC (never Windows time-zone names).
      Prefer: 'outlook.timezone="UTC"',
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
}

async function graphError(res: Response, what: string): Promise<Error> {
  const text = await res.text().catch(() => "");
  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
    if (parsed.error?.message) message = `${parsed.error.code ? `${parsed.error.code}: ` : ""}${parsed.error.message}`;
  } catch {
    // keep raw text
  }
  return new Error(redact(message || `${what} ${res.status}`));
}

export async function getOutlookAccountEmail(token: string, transport: FetchLike = timedFetch): Promise<string | null> {
  const res = await graph(token, "/me?$select=mail,userPrincipalName", { transport });
  if (!res.ok) return null;
  const json = (await res.json()) as { mail?: string | null; userPrincipalName?: string | null };
  return json.mail || json.userPrincipalName || null;
}

export async function listOutlookCalendars(token: string, transport: FetchLike = timedFetch): Promise<OutlookCalendar[]> {
  const calendars: OutlookCalendar[] = [];
  let next: string | null = "/me/calendars?$select=id,name,isDefaultCalendar,canEdit,hexColor&$top=100";
  for (let page = 0; page < 5 && next; page++) {
    const res = await graph(token, next, { transport });
    if (!res.ok) throw await graphError(res, "calendars");
    const json = (await res.json()) as {
      value?: { id?: string; name?: string; isDefaultCalendar?: boolean; canEdit?: boolean; hexColor?: string }[];
      "@odata.nextLink"?: string;
    };
    for (const c of json.value ?? []) {
      if (!c.id) continue;
      calendars.push({
        id: c.id,
        name: c.name || "Calendar",
        isDefault: Boolean(c.isDefaultCalendar),
        canEdit: c.canEdit !== false,
        color: c.hexColor && /^#[0-9a-f]{6}$/i.test(c.hexColor) ? c.hexColor : null,
      });
    }
    next = json["@odata.nextLink"] ?? null;
  }
  return calendars;
}

/** Graph date-time in UTC (no offset suffix; paired with timeZone "UTC"). */
function graphUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/Z$/, "");
}

export type OutlookEventDraft = {
  calendarId: string;
  existingEventId: string | null;
  summary: string;
  description: string;
  startIso: string;
  endIso?: string | null;
  location?: string | null;
  attendees?: { email: string; displayName?: string }[];
};

export async function upsertOutlookEvent(
  token: string,
  draft: OutlookEventDraft,
  transport: FetchLike = timedFetch
): Promise<{ eventId: string; created: boolean }> {
  const endIso = draft.endIso || new Date(Date.parse(draft.startIso) + EVENT_DURATION_MS).toISOString();
  const body: Record<string, unknown> = {
    subject: draft.summary,
    body: { contentType: "text", content: draft.description },
    start: { dateTime: graphUtc(draft.startIso), timeZone: "UTC" },
    end: { dateTime: graphUtc(endIso), timeZone: "UTC" },
  };
  if (draft.location !== undefined) body.location = { displayName: draft.location ?? "" };
  if (draft.attendees !== undefined) {
    body.attendees = draft.attendees.map((a) => ({
      emailAddress: { address: a.email, ...(a.displayName ? { name: a.displayName } : {}) },
      type: "required",
    }));
  }

  if (draft.existingEventId) {
    const res = await graph(token, `/me/events/${encodeURIComponent(draft.existingEventId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      transport,
    });
    if (res.ok) return { eventId: draft.existingEventId, created: false };
    if (res.status !== 404 && res.status !== 410) throw await graphError(res, "update event");
  }

  const res = await graph(token, `/me/calendars/${encodeURIComponent(draft.calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({ ...body, showAs: "busy" }),
    transport,
  });
  if (!res.ok) throw await graphError(res, "create event");
  const created = (await res.json()) as { id?: string };
  if (!created.id) throw new Error("Outlook did not return an event id.");
  return { eventId: created.id, created: true };
}

export async function deleteOutlookEvent(token: string, eventId: string, transport: FetchLike = timedFetch): Promise<void> {
  const res = await graph(token, `/me/events/${encodeURIComponent(eventId)}`, { method: "DELETE", transport });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw await graphError(res, "delete event");
}

type GraphViewEvent = {
  id?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  responseStatus?: { response?: string };
};

/** Busy (timed, not free, not cancelled/declined) intervals on one calendar. Times are UTC. */
export async function listOutlookBusy(
  token: string,
  calendarId: string,
  fromIso: string,
  toIso: string,
  transport: FetchLike = timedFetch
): Promise<{ id: string; start: number; end: number }[]> {
  const out: { id: string; start: number; end: number }[] = [];
  const params = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $select: "id,isAllDay,isCancelled,showAs,start,end,responseStatus",
    $top: "250",
  });
  let next: string | null = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
  for (let page = 0; page < 8 && next; page++) {
    const res = await graph(token, next, { transport });
    if (!res.ok) throw await graphError(res, "calendarView");
    const json = (await res.json()) as { value?: GraphViewEvent[]; "@odata.nextLink"?: string };
    for (const e of json.value ?? []) {
      if (!e.id || e.isCancelled || e.isAllDay) continue;
      if (e.showAs === "free" || e.showAs === "workingElsewhere") continue;
      if (e.responseStatus?.response === "declined") continue;
      // Prefer: outlook.timezone="UTC" → "2026-11-24T15:00:00.0000000" (no suffix).
      const start = Date.parse(`${e.start?.dateTime ?? ""}Z`);
      const end = Date.parse(`${e.end?.dateTime ?? ""}Z`);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ id: e.id, start, end });
    }
    next = json["@odata.nextLink"] ?? null;
  }
  return out;
}

// ── connection storage ──────────────────────────────────────────────────────

const CONNECTION_COLUMNS =
  "business_id, connected_email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, calendar_id, calendar_name, busy_calendar_ids, status, last_error";

async function readConnection(businessId: string): Promise<{ row: ConnectionRow | null; schemaReady: boolean }> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("outlook_calendar_connections").select(CONNECTION_COLUMNS).maybeSingle();
  if (error) return { row: null, schemaReady: !isMissingTable(error) };
  return { row: (data as ConnectionRow | null) ?? null, schemaReady: true };
}

async function updateConnection(businessId: string, patch: Record<string, unknown>): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("outlook_calendar_connections").update(patch).eq("business_id", businessId);
  if (error) throw new Error(redact(error.message));
}

type Access = { ok: true; token: string; row: ConnectionRow } | { ok: false; error: "not_connected" | "needs_reconnect" | "unavailable" };

/** Live access token for the business connection (refreshed and re-stored when needed). */
export async function getOutlookAccess(businessId: string, transport: FetchLike = timedFetch): Promise<Access> {
  const { row } = await readConnection(businessId);
  if (!row) return { ok: false, error: "not_connected" };
  if (row.status === "needs_reconnect") return { ok: false, error: "needs_reconnect" };
  let token: string;
  try {
    token = decrypt(row.access_token_ciphertext);
  } catch {
    return { ok: false, error: "unavailable" };
  }
  const exp = row.token_expires_at ? Date.parse(row.token_expires_at) : 0;
  if (!exp || exp < Date.now() + 120_000) {
    try {
      const bundle = await refreshOutlookAccessToken(decrypt(row.refresh_token_ciphertext), transport);
      token = bundle.accessToken;
      await updateConnection(businessId, {
        access_token_ciphertext: encrypt(bundle.accessToken),
        refresh_token_ciphertext: encrypt(bundle.refreshToken),
        token_expires_at: bundle.expiresAt,
        status: "active",
        last_error: null,
      });
    } catch (err) {
      const permanent = Boolean((err as { permanent?: boolean }).permanent);
      if (permanent) {
        await updateConnection(businessId, {
          status: "needs_reconnect",
          last_error: redact(err instanceof Error ? err.message : "refresh_failed"),
        }).catch(() => null);
        return { ok: false, error: "needs_reconnect" };
      }
      return { ok: false, error: "unavailable" };
    }
  }
  return { ok: true, token, row };
}

async function countAttention(businessId: string): Promise<number> {
  const db = await createTenantServiceClient(businessId);
  const { count, error } = await db
    .from("outlook_calendar_events")
    .select("proposal_id", { count: "exact", head: true })
    .eq("sync_status", "error");
  return error ? 0 : count ?? 0;
}

export async function getOutlookCalendarPublicStatus(businessId: string): Promise<OutlookCalendarPublicStatus> {
  const configured = outlookCalendarConfigured();
  const { row, schemaReady } = await readConnection(businessId);
  const empty: OutlookCalendarPublicStatus = {
    configured,
    schemaReady,
    connected: false,
    status: "disconnected",
    email: null,
    calendarId: null,
    calendarName: null,
    busyCalendarIds: [],
    lastError: null,
    attentionCount: 0,
    calendars: [],
  };
  if (!schemaReady) return empty;
  const attentionCount = await countAttention(businessId);
  if (!row) return { ...empty, attentionCount };

  let calendars: OutlookCalendar[] = [];
  if (row.status === "active") {
    const access = await getOutlookAccess(businessId);
    if (access.ok) calendars = await listOutlookCalendars(access.token).catch(() => []);
  }
  const fresh = (await readConnection(businessId)).row ?? row;
  return {
    configured,
    schemaReady,
    connected: fresh.status === "active",
    status: fresh.status,
    email: fresh.connected_email,
    calendarId: fresh.calendar_id,
    calendarName: fresh.calendar_name,
    busyCalendarIds: fresh.busy_calendar_ids ?? [],
    lastError: fresh.last_error,
    attentionCount,
    calendars,
  };
}

export async function completeOutlookCalendarConnect(args: { businessId: string; userId: string; code: string }): Promise<void> {
  const tokens = await exchangeOutlookAuthCode(args.code);
  const [email, calendars] = await Promise.all([
    getOutlookAccountEmail(tokens.accessToken),
    listOutlookCalendars(tokens.accessToken),
  ]);
  const writable = calendars.filter((c) => c.canEdit);
  const primary = writable.find((c) => c.isDefault) ?? writable[0] ?? null;
  const { row: existing } = await readConnection(args.businessId);
  // Reconnecting the same account keeps earlier choices when those calendars still exist.
  const sameAccount = existing && existing.connected_email && email && existing.connected_email.toLowerCase() === email.toLowerCase();
  const keepWrite = sameAccount && existing.calendar_id && writable.some((c) => c.id === existing.calendar_id);
  const keptBusy = sameAccount ? (existing.busy_calendar_ids ?? []).filter((id) => calendars.some((c) => c.id === id)) : [];
  const writeCal = keepWrite ? writable.find((c) => c.id === existing.calendar_id)! : primary;

  const db = await createTenantServiceClient(args.businessId);
  const { error } = await db.from("outlook_calendar_connections").upsert({
    connected_email: email,
    access_token_ciphertext: encrypt(tokens.accessToken),
    refresh_token_ciphertext: encrypt(tokens.refreshToken),
    token_expires_at: tokens.expiresAt,
    calendar_id: writeCal?.id ?? null,
    calendar_name: writeCal?.name ?? null,
    // A first connect blocks availability with the default calendar (the usual "my calendar").
    busy_calendar_ids: keptBusy.length ? keptBusy : primary ? [primary.id] : [],
    status: "active",
    last_error: null,
    connected_by: args.userId,
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error(redact(error.message));
}

export async function updateOutlookSettings(
  businessId: string,
  input: { calendarId?: string; busyCalendarIds?: string[] }
): Promise<{ calendarId: string | null; calendarName: string | null; busyCalendarIds: string[] }> {
  const access = await getOutlookAccess(businessId, fetch);
  if (!access.ok) throw new Error("Outlook Calendar needs to be reconnected.");
  const calendars = await listOutlookCalendars(access.token, fetch);
  const patch: Record<string, unknown> = { last_error: null };
  if (input.calendarId !== undefined) {
    const match = calendars.find((c) => c.id === input.calendarId && c.canEdit);
    if (!match) throw new Error("That calendar can't be written to on the connected account.");
    patch.calendar_id = match.id;
    patch.calendar_name = match.name;
  }
  if (input.busyCalendarIds !== undefined) {
    const known = new Set(calendars.map((c) => c.id));
    patch.busy_calendar_ids = [...new Set(input.busyCalendarIds.filter((id) => known.has(id)))].slice(0, 20);
  }
  await updateConnection(businessId, patch);
  const { row } = await readConnection(businessId);
  return {
    calendarId: row?.calendar_id ?? null,
    calendarName: row?.calendar_name ?? null,
    busyCalendarIds: row?.busy_calendar_ids ?? [],
  };
}

/**
 * Removes the connection and ShootPortal's event links. Events already on the Outlook calendar
 * stay there (same as Google). Microsoft has no token-revoke endpoint for this flow; the owner can
 * remove the app at https://myapps.microsoft.com or https://account.live.com/consent/Manage.
 */
export async function disconnectOutlookCalendar(businessId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db.from("outlook_calendar_events").delete().eq("business_id", businessId);
  const { error } = await db.from("outlook_calendar_connections").delete().eq("business_id", businessId);
  if (error) throw new Error(redact(error.message));
}

// ── shoots → Outlook ────────────────────────────────────────────────────────

type ShootRow = {
  id: string;
  project_id: string;
  proposed_at: string;
  status: string;
  end_at?: string | null;
  assigned_user_id?: string | null;
  projects?: unknown;
};

const SHOOT_BASE =
  "id, project_id, proposed_at, status, projects(project_name, property_address, service_type, clients(name, full_name, email, phone))";
const SHOOT_V132 = `${SHOOT_BASE}, end_at, assigned_user_id`;

async function loadShoot(businessId: string, proposalId: string): Promise<{ row: ShootRow | null; v132: boolean }> {
  const db = await createTenantServiceClient(businessId);
  const extended = await db.from("shoot_proposals").select(SHOOT_V132).eq("id", proposalId).maybeSingle();
  if (!extended.error) return { row: (extended.data as unknown as ShootRow | null) ?? null, v132: true };
  const base = await db.from("shoot_proposals").select(SHOOT_BASE).eq("id", proposalId).maybeSingle();
  return { row: (base.data as unknown as ShootRow | null) ?? null, v132: false };
}

type EventLink = { proposal_id: string; event_id: string | null; calendar_id: string | null; project_id: string | null };

async function readEventLink(businessId: string, proposalId: string): Promise<EventLink | null> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("outlook_calendar_events")
    .select("proposal_id, event_id, calendar_id, project_id")
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) return null;
  return (data as EventLink | null) ?? null;
}

async function writeEventLink(
  businessId: string,
  link: { proposalId: string; projectId: string | null; eventId: string | null; calendarId: string | null; status: "synced" | "error"; error: string | null }
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db.from("outlook_calendar_events").upsert({
    proposal_id: link.proposalId,
    project_id: link.projectId,
    event_id: link.eventId,
    calendar_id: link.calendarId,
    sync_status: link.status,
    sync_error: link.error ? redact(link.error) : null,
    synced_at: new Date().toISOString(),
  });
}

async function dropEventLink(businessId: string, proposalId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db.from("outlook_calendar_events").delete().eq("proposal_id", proposalId);
}

async function eventTextFor(businessId: string, shoot: ShootRow, v132: boolean, accountEmail: string | null) {
  const settings = await getAppSettings(businessId);
  const project = shoot.projects as {
    project_name?: string;
    property_address?: string;
    service_type?: string;
    clients?: { name?: string; full_name?: string; email?: string; phone?: string } | null;
  } | null;
  const raw = await createServiceClient();
  const db = await createTenantServiceClient(businessId);
  const [staffProfile, serviceLinks, portalOrigin] = await Promise.all([
    shoot.assigned_user_id
      ? raw
          .from("profiles")
          .select("full_name, email")
          .eq("id", shoot.assigned_user_id)
          .maybeSingle()
          .then((r) => r.data as { full_name?: string | null; email?: string | null } | null)
      : Promise.resolve(null),
    db
      .from("project_services")
      .select("service_name, position")
      .eq("project_id", shoot.project_id)
      .order("position", { ascending: true })
      .then((r) => (r.error ? [] : (r.data ?? []))),
    getBusinessPortalOriginById(businessId).catch(() => null),
  ]);
  const services = serviceLinks.length
    ? serviceLinks.map((s) => s.service_name as string).join(", ")
    : project?.service_type ?? "";
  const clientName = project?.clients?.full_name || project?.clients?.name || "Client";
  const durationMinutes = shoot.end_at ? Math.round((Date.parse(shoot.end_at) - Date.parse(shoot.proposed_at)) / 60_000) : 60;
  const events = settings.booking.events;
  const text = buildEventText({
    settings: events,
    values: {
      property_address: project?.property_address ?? "",
      client_name: clientName,
      client_phone: project?.clients?.phone ?? "",
      client_email: project?.clients?.email ?? "",
      project_name: project?.project_name ?? "Project",
      services,
      photographer: staffProfile?.full_name || "",
      duration_minutes: durationMinutes,
      business_name: settings.business.businessName,
    },
    projectUrl: portalOrigin ? `${portalOrigin.replace(/\/$/, "")}/admin/projects/${shoot.project_id}` : null,
    pending: shoot.status === "pending",
  });
  // Same invite rules as the Google event (Settings → Instant Booking → calendar event).
  const attendees: { email: string; displayName?: string }[] = [];
  if (shoot.status === "confirmed") {
    const staffEmail = staffProfile?.email?.trim();
    if (events.inviteAssignedStaff && staffEmail && staffEmail.toLowerCase() !== (accountEmail ?? "").toLowerCase()) {
      attendees.push({ email: staffEmail, displayName: staffProfile?.full_name || undefined });
    }
    const clientEmail = project?.clients?.email?.trim();
    if (events.inviteClient && clientEmail) attendees.push({ email: clientEmail, displayName: clientName });
  }
  return {
    summary: text.summary,
    description: text.description,
    location: v132 ? text.location : undefined,
    attendees: v132 ? attendees : undefined,
  };
}

/** Removes the Outlook event for a shoot (if any) and forgets the link. */
async function removeOutlookShootEvent(businessId: string, proposalId: string): Promise<void> {
  const link = await readEventLink(businessId, proposalId);
  if (!link) return;
  if (!link.event_id) {
    await dropEventLink(businessId, proposalId);
    return;
  }
  const access = await getOutlookAccess(businessId);
  if (!access.ok) {
    await writeEventLink(businessId, {
      proposalId,
      projectId: link.project_id,
      eventId: link.event_id,
      calendarId: link.calendar_id,
      status: "error",
      error: "Outlook Calendar needs to be reconnected to remove this shoot.",
    });
    return;
  }
  try {
    await deleteOutlookEvent(access.token, link.event_id);
    await dropEventLink(businessId, proposalId);
  } catch (err) {
    await writeEventLink(businessId, {
      proposalId,
      projectId: link.project_id,
      eventId: link.event_id,
      calendarId: link.calendar_id,
      status: "error",
      error: err instanceof Error ? err.message : "Outlook delete failed",
    });
  }
}

/** Creates or updates the Outlook event for a pending/confirmed shoot; removes it otherwise. */
async function pushOutlookShoot(businessId: string, proposalId: string): Promise<void> {
  const { row: shoot, v132 } = await loadShoot(businessId, proposalId);
  if (!shoot) {
    await dropEventLink(businessId, proposalId);
    return;
  }
  if (shoot.status !== "confirmed" && shoot.status !== "pending") {
    await removeOutlookShootEvent(businessId, proposalId);
    return;
  }
  const link = await readEventLink(businessId, proposalId);
  const access = await getOutlookAccess(businessId);
  if (!access.ok || !access.row.calendar_id) {
    await writeEventLink(businessId, {
      proposalId,
      projectId: shoot.project_id,
      eventId: link?.event_id ?? null,
      calendarId: link?.calendar_id ?? null,
      status: "error",
      error: !access.ok ? "Outlook Calendar needs to be reconnected." : "Choose which Outlook calendar shoots go to.",
    });
    return;
  }
  const targetCalendar = access.row.calendar_id;
  let existingEventId = link?.event_id ?? null;
  // The owner picked a different write calendar since: move the event.
  if (existingEventId && link?.calendar_id && link.calendar_id !== targetCalendar) {
    await deleteOutlookEvent(access.token, existingEventId).catch(() => null);
    existingEventId = null;
  }
  try {
    const text = await eventTextFor(businessId, shoot, v132, access.row.connected_email);
    const result = await upsertOutlookEvent(access.token, {
      calendarId: targetCalendar,
      existingEventId,
      summary: text.summary,
      description: text.description,
      startIso: shoot.proposed_at,
      endIso: shoot.end_at ?? null,
      location: text.location,
      attendees: text.attendees,
    });
    await writeEventLink(businessId, {
      proposalId,
      projectId: shoot.project_id,
      eventId: result.eventId,
      calendarId: targetCalendar,
      status: "synced",
      error: null,
    });
  } catch (err) {
    await writeEventLink(businessId, {
      proposalId,
      projectId: shoot.project_id,
      eventId: existingEventId,
      calendarId: existingEventId ? link?.calendar_id ?? targetCalendar : null,
      status: "error",
      error: err instanceof Error ? err.message : "Outlook sync failed",
    });
  }
}

/**
 * Removes Outlook events for this project's other shoots that are no longer pending/confirmed
 * (offered times that were superseded or declined when one time was confirmed).
 */
export async function reconcileOutlookProject(businessId: string, projectId: string, exceptProposalId?: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { data: links, error } = await db.from("outlook_calendar_events").select("proposal_id").eq("project_id", projectId);
  if (error || !links?.length) return;
  const ids = links.map((l) => l.proposal_id as string).filter((id) => id !== exceptProposalId);
  if (!ids.length) return;
  const { data: rows } = await db.from("shoot_proposals").select("id, status").in("id", ids);
  const live = new Map((rows ?? []).map((r) => [r.id as string, r.status as string]));
  for (const id of ids) {
    const status = live.get(id);
    if (status !== "pending" && status !== "confirmed") await removeOutlookShootEvent(businessId, id);
  }
}

async function outlookConnected(businessId: string): Promise<boolean> {
  const { row } = await readConnection(businessId);
  return Boolean(row);
}

/**
 * Never throws. Call next to every Google sync: shoot writes must succeed whatever Outlook does.
 * A business without an Outlook connection costs one small database read.
 */
export async function syncShootToOutlookSafe(businessId: string, proposalId: string, mode: "upsert" | "delete"): Promise<void> {
  try {
    if (mode === "delete") {
      await removeOutlookShootEvent(businessId, proposalId);
      return;
    }
    if (!(await outlookConnected(businessId))) return;
    await pushOutlookShoot(businessId, proposalId);
    const link = await readEventLink(businessId, proposalId);
    if (link?.project_id) await reconcileOutlookProject(businessId, link.project_id, proposalId);
  } catch (err) {
    console.error("[outlook-calendar] sync failed", {
      businessId,
      proposalId,
      mode,
      error: err instanceof Error ? redact(err.message) : "unknown",
    });
  }
}

/** Never throws. Clean up Outlook events of a project's superseded / declined offers. */
export async function reconcileOutlookProjectSafe(businessId: string, projectId: string): Promise<void> {
  try {
    await reconcileOutlookProject(businessId, projectId);
  } catch (err) {
    console.error("[outlook-calendar] reconcile failed", { businessId, projectId, error: err instanceof Error ? redact(err.message) : "unknown" });
  }
}

/** Re-push shoots whose Outlook sync failed (calendar page visit + daily cron). */
export async function retryOutlookAttentionSyncs(businessId: string): Promise<number> {
  if (!(await outlookConnected(businessId))) return 0;
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("outlook_calendar_events").select("proposal_id").eq("sync_status", "error").limit(8);
  if (error) return 0;
  let n = 0;
  for (const row of data ?? []) {
    await syncShootToOutlookSafe(businessId, row.proposal_id as string, "upsert");
    n += 1;
  }
  return n;
}

// ── Outlook busy times → Instant Booking ────────────────────────────────────

export type OutlookBusyResult = {
  /** True when this business has Outlook calendars set to block availability. */
  active: boolean;
  intervals: { start: number; end: number; label: string }[];
  /** A blocking calendar couldn't be read (booking fails closed, like Google). */
  failed: boolean;
};

/**
 * Busy times from the business's Outlook "block availability" calendars. They block the owner
 * (the same people the business-level Google block calendars apply to). Events ShootPortal itself
 * created are skipped — those shoots already block from ShootPortal's own records.
 */
export async function loadOutlookBusy(businessId: string, fromMs: number, toMs: number): Promise<OutlookBusyResult> {
  const none: OutlookBusyResult = { active: false, intervals: [], failed: false };
  try {
    const { row } = await readConnection(businessId);
    const calendarIds = row?.busy_calendar_ids ?? [];
    if (!row || !calendarIds.length) return none;
    const access = await getOutlookAccess(businessId);
    if (!access.ok) return { active: true, intervals: [], failed: true };
    const db = await createTenantServiceClient(businessId);
    const [{ data: own }, eventIds] = await Promise.all([
      db.from("outlook_calendar_events").select("event_id").not("event_id", "is", null),
      ownCalendarEventOutlookIds(businessId),
    ]);
    // Shoots and calendar events (v139) already block in ShootPortal: don't count their copies.
    const ownIds = new Set([...(own ?? []).map((r) => r.event_id as string), ...eventIds]);
    const fromIso = new Date(fromMs).toISOString();
    const toIso = new Date(toMs).toISOString();
    let failed = false;
    const intervals: OutlookBusyResult["intervals"] = [];
    await Promise.all(
      calendarIds.map(async (id) => {
        try {
          const busy = await listOutlookBusy(access.token, id, fromIso, toIso);
          for (const b of busy) if (!ownIds.has(b.id)) intervals.push({ start: b.start, end: b.end, label: "Busy" });
        } catch {
          failed = true;
        }
      })
    );
    return { active: true, intervals, failed };
  } catch {
    return { active: true, intervals: [], failed: true };
  }
}

// ── daily upkeep ────────────────────────────────────────────────────────────

/**
 * Keeps the Microsoft refresh token alive (they lapse after ~90 days unused) and retries failed
 * shoot syncs. Never throws.
 */
export async function outlookDailyUpkeep(businessId: string): Promise<{ ok: boolean; retried: number }> {
  try {
    const { row } = await readConnection(businessId);
    if (!row || row.status !== "active") return { ok: false, retried: 0 };
    const refresh = await refreshOutlookAccessToken(decrypt(row.refresh_token_ciphertext), fetch).catch(async (err) => {
      if ((err as { permanent?: boolean }).permanent) {
        await updateConnection(businessId, {
          status: "needs_reconnect",
          last_error: redact(err instanceof Error ? err.message : "refresh_failed"),
        }).catch(() => null);
      }
      return null;
    });
    if (!refresh) return { ok: false, retried: 0 };
    await updateConnection(businessId, {
      access_token_ciphertext: encrypt(refresh.accessToken),
      refresh_token_ciphertext: encrypt(refresh.refreshToken),
      token_expires_at: refresh.expiresAt,
      last_error: null,
    });
    const retried = await retryOutlookAttentionSyncs(businessId);
    return { ok: true, retried };
  } catch {
    return { ok: false, retried: 0 };
  }
}

// ── Shoot Calendar display (v138) ───────────────────────────────────────────
// Outlook events shown read-only on the Shoot Calendar, beside Google events. Ids are prefixed
// "outlook:" on the way out so they never collide with Google calendar/event ids in the client.

export const OUTLOOK_DISPLAY_PREFIX = "outlook:";

type GraphDisplayEvent = GraphViewEvent & { subject?: string; webLink?: string };

/** Every displayable event (incl. free and all-day; not cancelled/declined) on one calendar. */
export async function listOutlookDisplayEvents(
  token: string,
  calendarId: string,
  fromIso: string,
  toIso: string,
  transport: FetchLike = timedFetch
): Promise<GraphDisplayEvent[]> {
  const out: GraphDisplayEvent[] = [];
  const params = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $select: "id,subject,webLink,isAllDay,isCancelled,showAs,start,end,responseStatus",
    $top: "250",
  });
  let next: string | null = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
  for (let page = 0; page < 8 && next; page++) {
    const res = await graph(token, next, { transport });
    if (!res.ok) throw await graphError(res, "calendarView");
    const json = (await res.json()) as { value?: GraphDisplayEvent[]; "@odata.nextLink"?: string };
    for (const e of json.value ?? []) {
      if (!e.id || e.isCancelled || e.responseStatus?.response === "declined") continue;
      out.push(e);
    }
    next = json["@odata.nextLink"] ?? null;
  }
  return out;
}

/** Graph event (UTC wall times) → the Google-shaped input toExternalEvent understands. */
export function outlookEventAsGoogleShape(e: GraphDisplayEvent) {
  const startRaw = e.start?.dateTime ?? "";
  const endRaw = e.end?.dateTime ?? "";
  if (e.isAllDay) {
    // All-day events are floating dates: keep the calendar date, end is exclusive (like Google).
    return {
      id: e.id,
      summary: e.subject,
      htmlLink: e.webLink,
      start: { date: startRaw.slice(0, 10) },
      end: endRaw ? { date: endRaw.slice(0, 10) } : undefined,
    };
  }
  const toIso = (raw: string) => {
    const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
  };
  const start = toIso(startRaw);
  const end = endRaw ? toIso(endRaw) : "";
  return {
    id: e.id,
    summary: e.subject,
    htmlLink: e.webLink,
    start: start ? { dateTime: start } : {},
    end: end ? { dateTime: end } : undefined,
  };
}

export type OutlookDisplayCalendar = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
  accessRole: string | null;
};

export type OutlookDisplayWindow = {
  connected: boolean;
  status: "disconnected" | "active" | "needs_reconnect";
  /** False until migration v138: choices show but aren't saved. */
  prefsReady: boolean;
  calendars: OutlookDisplayCalendar[];
  hiddenCalendarIds: string[];
  colors: Record<string, string>;
  events: ExternalCalendarEvent[];
  degraded: boolean;
};

async function readDisplayPrefs(
  businessId: string
): Promise<{ ready: boolean; hidden: string[] | null; colors: Record<string, string> }> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("outlook_calendar_connections")
    .select("display_hidden_calendar_ids, display_calendar_colors")
    .maybeSingle();
  if (error || !data) return { ready: !error, hidden: null, colors: {} };
  const row = data as { display_hidden_calendar_ids: string[] | null; display_calendar_colors: Record<string, string> | null };
  return { ready: true, hidden: row.display_hidden_calendar_ids, colors: row.display_calendar_colors || {} };
}

const prefixId = (id: string) => `${OUTLOOK_DISPLAY_PREFIX}${id}`;
const unprefixId = (id: string) => (id.startsWith(OUTLOOK_DISPLAY_PREFIX) ? id.slice(OUTLOOK_DISPLAY_PREFIX.length) : id);

/** Outlook calendars + events for the Shoot Calendar window (all calendars; the client filters). */
export async function loadOutlookDisplayWindow(
  businessId: string,
  fromIso: string,
  toIso: string,
  timeZone: string
): Promise<OutlookDisplayWindow> {
  const empty: OutlookDisplayWindow = {
    connected: false,
    status: "disconnected",
    prefsReady: false,
    calendars: [],
    hiddenCalendarIds: [],
    colors: {},
    events: [],
    degraded: false,
  };
  const access = await getOutlookAccess(businessId);
  if (!access.ok) {
    if (access.error === "not_connected") return empty;
    return { ...empty, connected: true, status: "needs_reconnect", degraded: true };
  }
  const [calendars, prefs, ownRows, eventIds] = await Promise.all([
    listOutlookCalendars(access.token),
    readDisplayPrefs(businessId),
    createTenantServiceClient(businessId).then((db) =>
      db.from("outlook_calendar_events").select("event_id").not("event_id", "is", null)
    ),
    ownCalendarEventOutlookIds(businessId),
  ]);
  // ShootPortal's own shoots and calendar events are already on the grid: don't show their Outlook copies too.
  const ownIds = new Set([...((ownRows.data ?? []) as { event_id: string }[]).map((r) => r.event_id), ...eventIds]);
  const hiddenRaw = prefs.hidden ?? calendars.filter((c) => !c.canEdit).map((c) => c.id);
  const colors: Record<string, string> = {};
  for (const [id, color] of Object.entries(prefs.colors)) colors[prefixId(id)] = color;

  let degraded = false;
  const events: OutlookDisplayWindow["events"] = [];
  await Promise.all(
    calendars.map(async (cal) => {
      try {
        const raw = await listOutlookDisplayEvents(access.token, cal.id, fromIso, toIso);
        for (const e of raw) {
          if (e.id && ownIds.has(e.id)) continue;
          const shaped = toExternalEvent(outlookEventAsGoogleShape(e), prefixId(cal.id), cal.name, timeZone, cal.color);
          if (shaped) events.push({ ...shaped, id: prefixId(shaped.id) });
        }
      } catch {
        degraded = true;
      }
    })
  );

  return {
    connected: true,
    status: "active",
    prefsReady: prefs.ready,
    calendars: calendars.map((c) => ({
      id: prefixId(c.id),
      summary: c.name,
      primary: c.isDefault,
      backgroundColor: c.color,
      accessRole: c.canEdit ? "owner" : "reader",
    })),
    hiddenCalendarIds: hiddenRaw.map(prefixId),
    colors,
    events,
    degraded,
  };
}

export async function setOutlookDisplayHidden(businessId: string, hidden: string[]): Promise<string[]> {
  const ids = [...new Set(hidden.map((id) => unprefixId(id.trim())).filter((id) => id && id.length <= 512))].slice(0, 100);
  await updateConnection(businessId, { display_hidden_calendar_ids: ids });
  return ids.map(prefixId);
}

export async function setOutlookDisplayColor(businessId: string, key: string, color: string | null): Promise<Record<string, string>> {
  const id = unprefixId(key.trim());
  if (!id || id.length > 512) throw new Error("Invalid calendar.");
  if (color !== null && !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color.trim())) throw new Error("Use a hex color, like #2563EB.");
  const prefs = await readDisplayPrefs(businessId);
  if (!prefs.ready) throw new Error("Apply database migration v138 to save Outlook calendar colors.");
  const next = { ...prefs.colors };
  if (color === null) delete next[id];
  else next[id] = color.trim();
  await updateConnection(businessId, { display_calendar_colors: next });
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(next)) out[prefixId(k)] = v;
  return out;
}

/** Outlook ids of ShootPortal calendar events (v139). Empty before the migration. */
async function ownCalendarEventOutlookIds(businessId: string): Promise<string[]> {
  try {
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db.from("calendar_events").select("outlook_event_id").not("outlook_event_id", "is", null);
    if (error) return [];
    return ((data ?? []) as { outlook_event_id: string }[]).map((r) => r.outlook_event_id);
  } catch {
    return [];
  }
}
