import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isBusinessOperator } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import {
  deleteGoogleEvent,
  getMemberGoogleAccess,
  googleCalendarConfigured,
  listAccountCalendars,
  listMemberConnections,
  revokeGoogleToken,
  syncShootToGoogleSafe,
} from "@/lib/google-calendar";
import { decryptCalendarSecret } from "@/lib/google-calendar-crypto";

/**
 * The signed-in team member's own Google Calendar connection (Instant Booking).
 * GET    status, their calendars, and how the business uses them
 * PUT    { busyCalendarIds, destinationCalendarId }
 * DELETE disconnect (future shoots on their calendar move back to the business calendar)
 */
async function context(write: boolean) {
  const profile = await getProfile();
  if (!profile || !isBusinessOperator(profile)) {
    return { error: NextResponse.json({ error: "Team members only." }, { status: 403 }) } as const;
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) } as const;
  if (profile.business_id && profile.business_id !== tenant.businessId) {
    return { error: NextResponse.json({ error: "Wrong business." }, { status: 403 }) } as const;
  }
  if (write && tenant.impersonating && !tenant.allowWrites) {
    return { error: NextResponse.json({ error: "Read-only session." }, { status: 403 }) } as const;
  }
  return { profile, businessId: tenant.businessId } as const;
}

async function tableReady(businessId: string): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("team_google_calendar_connections").select("user_id").limit(1);
  return !error;
}

export async function GET() {
  const ctx = await context(false);
  if ("error" in ctx) return ctx.error;
  const [ready, settings] = await Promise.all([tableReady(ctx.businessId), getAppSettings(ctx.businessId)]);
  const connection = ready ? ((await listMemberConnections(ctx.businessId)).find((c) => c.userId === ctx.profile.id) ?? null) : null;
  let calendars: { id: string; summary: string; primary: boolean; writable: boolean }[] = [];
  let calendarsError: string | null = null;
  if (connection?.status === "active") {
    const access = await getMemberGoogleAccess(ctx.businessId, ctx.profile.id);
    if (access.ok) {
      try {
        calendars = (await listAccountCalendars(access.token)).map((c) => ({
          id: c.id,
          summary: c.summary,
          primary: c.primary,
          writable: c.accessRole === "owner" || c.accessRole === "writer",
        }));
      } catch {
        calendarsError = "Couldn't load your calendars from Google. Try again, or reconnect.";
      }
    }
  }
  // Re-read: a failed token refresh above flips the status to needs_reconnect.
  const refreshed = connection ? ((await listMemberConnections(ctx.businessId)).find((c) => c.userId === ctx.profile.id) ?? null) : null;
  return NextResponse.json({
    configured: googleCalendarConfigured(),
    ready,
    connection: refreshed,
    calendars,
    calendarsError,
    strategy: settings.booking.calendarStrategy,
    connectUrl: "/api/integrations/google-calendar/start?for=me",
  });
}

export async function PUT(request: Request) {
  const ctx = await context(true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => null)) as { busyCalendarIds?: unknown; destinationCalendarId?: unknown } | null;
  const access = await getMemberGoogleAccess(ctx.businessId, ctx.profile.id);
  if (!access.ok) return NextResponse.json({ error: "Connect your Google Calendar first." }, { status: 409 });
  const calendars = await listAccountCalendars(access.token).catch(() => null);
  if (!calendars) return NextResponse.json({ error: "Couldn't reach Google. Try again." }, { status: 502 });
  const known = new Map(calendars.map((c) => [c.id, c]));
  const busy = Array.isArray(body?.busyCalendarIds)
    ? [...new Set(body!.busyCalendarIds.filter((id): id is string => typeof id === "string" && known.has(id)))].slice(0, 20)
    : null;
  const destinationId = typeof body?.destinationCalendarId === "string" ? body.destinationCalendarId : null;
  const destination = destinationId ? known.get(destinationId) : null;
  if (destinationId && (!destination || !(destination.accessRole === "owner" || destination.accessRole === "writer"))) {
    return NextResponse.json({ error: "Choose a calendar you can add events to." }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (busy) patch.busy_calendar_ids = busy;
  if (destination) {
    patch.destination_calendar_id = destination.id;
    patch.destination_calendar_summary = destination.summary;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const db = await createTenantServiceClient(ctx.businessId);
  const { error } = await db.from("team_google_calendar_connections").update(patch).eq("user_id", ctx.profile.id);
  if (error) return NextResponse.json({ error: "Couldn't save your calendar choices." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const ctx = await context(true);
  if ("error" in ctx) return ctx.error;
  const db = await createTenantServiceClient(ctx.businessId);
  const access = await getMemberGoogleAccess(ctx.businessId, ctx.profile.id);

  // Upcoming shoots whose events live on this person's calendar move to the business calendar.
  const { data: owned } = await db
    .from("shoot_proposals")
    .select("id, google_event_id, google_calendar_id")
    .eq("google_owner_user_id", ctx.profile.id)
    .eq("status", "confirmed")
    .gt("proposed_at", new Date().toISOString());
  for (const row of owned ?? []) {
    if (access.ok && row.google_event_id) {
      await deleteGoogleEvent(access.token, (row.google_calendar_id as string | null) || "primary", row.google_event_id as string).catch(() => null);
    }
    await db
      .from("shoot_proposals")
      .update({ google_event_id: null, google_calendar_id: null, google_owner_user_id: null, google_sync_status: null })
      .eq("id", row.id);
  }

  const { data: tokenRow } = await db
    .from("team_google_calendar_connections")
    .select("refresh_token_ciphertext, connected_email")
    .eq("user_id", ctx.profile.id)
    .maybeSingle();
  // Google revokes the whole sign-in for that Google account, not just this token. When the
  // business connection (Settings → Integrations) uses the same Google account, revoking here
  // would silently break it too, so only forget this personal connection in that case.
  const { data: businessRow } = await db.from("google_calendar_connections").select("connected_email").maybeSingle();
  const personalEmail = String(tokenRow?.connected_email || "").trim().toLowerCase();
  const sharesBusinessGrant =
    Boolean(personalEmail) && personalEmail === String(businessRow?.connected_email || "").trim().toLowerCase();
  if (tokenRow?.refresh_token_ciphertext && !sharesBusinessGrant) {
    await revokeGoogleToken(decryptCalendarSecret(tokenRow.refresh_token_ciphertext as string)).catch(() => null);
  }
  const { error } = await db.from("team_google_calendar_connections").delete().eq("user_id", ctx.profile.id);
  if (error) return NextResponse.json({ error: "Couldn't disconnect. Try again." }, { status: 500 });

  for (const row of owned ?? []) await syncShootToGoogleSafe(ctx.businessId, row.id as string, "upsert");
  return NextResponse.json({ ok: true, moved: owned?.length ?? 0 });
}
