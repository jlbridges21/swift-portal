import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GCAL_TABLE = "google_calendar_connections_v2";

export interface GoogleCalendarConnection {
  business_id: string;
  connected_email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string | null;
  calendar_summary: string | null;
  connected_at: string;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${appUrl}/api/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(getGoogleConfig());
}

function oauthStateSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GOOGLE_CLIENT_SECRET is required to sign OAuth state");
  }
  return secret;
}

/** HMAC-SHA256 state: `{businessId}.{timestamp}.{nonce}.{sig}` */
export function signGoogleOAuthState(businessId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${businessId}.${ts}.${nonce}`;
  const sig = createHmac("sha256", oauthStateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthState(
  state: string
): { ok: true; businessId: string } | { ok: false; reason: string } {
  if (!state || typeof state !== "string") return { ok: false, reason: "missing" };
  const parts = state.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [businessId, ts, nonce, sig] = parts;
  if (!businessId || !ts || !nonce || !sig) return { ok: false, reason: "malformed" };

  const payload = `${businessId}.${ts}.${nonce}`;
  const expected = createHmac("sha256", oauthStateSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }
  } catch {
    return { ok: false, reason: "bad_signature" };
  }

  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > OAUTH_STATE_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, businessId };
}

export function getGoogleOAuthUrl(state: string): string | null {
  const config = getGoogleConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google Calendar is not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google Calendar is not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google access token");
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getGoogleCalendarConnection(
  businessId: string
): Promise<GoogleCalendarConnection | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from(GCAL_TABLE).select("*").maybeSingle();
  return (data as GoogleCalendarConnection | null) ?? null;
}

export async function saveGoogleCalendarConnection(options: {
  businessId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string | null;
  userId?: string | null;
}) {
  const db = await createTenantServiceClient(options.businessId);
  const expiresAt = new Date(Date.now() + options.expiresIn * 1000).toISOString();

  const { data: existing } = await db.from(GCAL_TABLE).select("refresh_token").maybeSingle();

  await db.from(GCAL_TABLE).upsert(
    {
      connected_email: options.email ?? null,
      access_token: options.accessToken,
      refresh_token: options.refreshToken || existing?.refresh_token,
      token_expires_at: expiresAt,
      connected_by: options.userId ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );
}

export async function disconnectGoogleCalendar(businessId: string) {
  const db = await createTenantServiceClient(businessId);
  await db.from(GCAL_TABLE).delete();
}

export async function setGoogleCalendarId(
  businessId: string,
  calendarId: string,
  calendarSummary: string
) {
  const db = await createTenantServiceClient(businessId);
  await db
    .from(GCAL_TABLE)
    .update({ calendar_id: calendarId, calendar_summary: calendarSummary });
}

async function getValidAccessToken(
  conn: GoogleCalendarConnection,
  businessId: string
): Promise<string> {
  const expires = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expires - 60_000) return conn.access_token;

  const refreshed = await refreshGoogleAccessToken(conn.refresh_token);
  const db = await createTenantServiceClient(businessId);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await db
    .from(GCAL_TABLE)
    .update({ access_token: refreshed.access_token, token_expires_at: expiresAt });

  return refreshed.access_token;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
}

export async function listGoogleCalendars(businessId: string): Promise<GoogleCalendarListItem[]> {
  const conn = await getGoogleCalendarConnection(businessId);
  if (!conn) return [];

  const token = await getValidAccessToken(conn, businessId);
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((c: { id: string; summary: string; primary?: boolean }) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
  }));
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

interface ShootSyncContext {
  proposalId: string;
  projectId: string;
  proposedAt: string;
  propertyAddress: string;
  projectName: string;
  serviceType: string;
  clientName: string;
  notes?: string | null;
  existingEventId?: string | null;
}

function mapsDirectionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function buildEventBody(ctx: ShootSyncContext, appUrl: string) {
  const start = new Date(ctx.proposedAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const projectUrl = `${appUrl}/admin/projects/${ctx.projectId}`;

  return {
    summary: `${ctx.serviceType} — ${ctx.propertyAddress.split(",")[0]}`,
    location: ctx.propertyAddress,
    description: [
      `Client: ${ctx.clientName}`,
      `Service: ${ctx.serviceType}`,
      `Project: ${ctx.projectName}`,
      `Portal: ${projectUrl}`,
      `Directions: ${mapsDirectionsUrl(ctx.propertyAddress)}`,
      ctx.notes ? `Notes: ${ctx.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
  };
}

/** Mirror a confirmed shoot to Google Calendar (create or update). Swift Portal is source of truth. */
export async function syncShootToGoogleCalendar(
  ctx: ShootSyncContext,
  businessId: string
): Promise<string | null> {
  try {
    const conn = await getGoogleCalendarConnection(businessId);
    if (!conn?.calendar_id) return null;

    const token = await getValidAccessToken(conn, businessId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const body = buildEventBody(ctx, appUrl);
    const calendarId = encodeURIComponent(conn.calendar_id);

    if (ctx.existingEventId) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(ctx.existingEventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) return ctx.existingEventId;
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      console.error("[google-calendar] sync failed:", await res.text());
      return null;
    }

    const event = await res.json();
    const db = await createTenantServiceClient(businessId);
    await db
      .from("shoot_proposals")
      .update({ google_calendar_event_id: event.id })
      .eq("id", ctx.proposalId);

    return event.id as string;
  } catch (err) {
    console.error("[google-calendar] sync error:", err);
    return null;
  }
}

export async function loadShootSyncContext(
  proposalId: string,
  businessId: string
): Promise<ShootSyncContext | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("shoot_proposals")
    .select(`
      id, project_id, proposed_at, message, google_calendar_event_id,
      projects(project_name, property_address, service_type, notes, clients(name, full_name))
    `)
    .eq("id", proposalId)
    .single();

  if (!data) return null;

  const project = data.projects as unknown as {
    project_name: string;
    property_address: string;
    service_type: string;
    notes: string | null;
    clients: { name: string; full_name: string | null } | null;
  };

  return {
    proposalId: data.id,
    projectId: data.project_id,
    proposedAt: data.proposed_at,
    propertyAddress: project.property_address,
    projectName: project.project_name,
    serviceType: project.service_type,
    clientName: project.clients?.full_name || project.clients?.name || "Client",
    notes: data.message || project.notes,
    existingEventId: data.google_calendar_event_id,
  };
}
