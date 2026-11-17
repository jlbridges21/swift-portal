import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getGoogleCalendarPublicStatus, listMemberConnections } from "@/lib/google-calendar";
import { bookingSchemaReady, loadServiceBookingRules } from "@/lib/booking/server";
import { businessAddress, loadTeam, parseTeamProfile, resolveMember, saveTeamProfile } from "@/lib/booking/team";
import { routesConfigured } from "@/lib/booking/routes";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { listBusinessServices } from "@/lib/business-services";

/**
 * Scheduling settings data for Settings → Instant Booking / Services / Team & Availability:
 * readiness (migration, Routes key, Google), the team with scheduling profiles, and the
 * services' booking rules. Owner/admin only.
 */
export async function GET() {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  const businessId = tenant.businessId;
  const db = await createTenantServiceClient(businessId);

  const [settings, schemaReady, team, google, rules, services, memberCalendars] = await Promise.all([
    getAppSettings(businessId),
    bookingSchemaReady(db),
    loadTeam(businessId),
    getGoogleCalendarPublicStatus(businessId).catch(() => null),
    loadServiceBookingRules(db),
    listBusinessServices(businessId),
    listMemberConnections(businessId),
  ]);

  return NextResponse.json({
    viewerUserId: auth.profile.id,
    /** Team members' own Google connections (no tokens). */
    memberCalendars: memberCalendars.map((c) => ({ userId: c.userId, email: c.email, status: c.status })),
    schemaReady,
    profilesReady: team.profilesReady && schemaReady,
    routesConfigured: routesConfigured(),
    businessAddress: businessAddress(settings),
    google: google
      ? {
          configured: google.configured,
          connected: google.connected,
          status: google.status,
          email: google.email,
          defaultCalendarId: google.calendarId,
          calendars: google.calendars,
        }
      : { configured: false, connected: false, status: "disconnected", email: null, defaultCalendarId: null, calendars: [] },
    team: team.members.map((m) => {
      const r = resolveMember(m, settings);
      return {
        ...m,
        effective: {
          workingHours: r.workingHours,
          maxShootsPerDay: r.maxShootsPerDay,
          baseAddress: r.baseAddress,
          serviceRadiusMiles: r.serviceRadiusMiles,
          weights: r.weights,
        },
      };
    }),
    services: services.map((s) => {
      const rule = rules.get(s.id);
      return {
        id: s.id,
        name: s.name,
        isActive: s.is_active,
        priceCents: s.preliminary_estimate_cents,
        hidePricing: s.hide_pricing,
        durationMinutes: rule?.durationMinutes ?? 60,
        bufferMinutes: rule?.bufferMinutes ?? 0,
        instantBookingAllowed: rule?.instantBookingAllowed ?? true,
        outsideRadiusRequiresQuote: rule?.outsideRadiusRequiresQuote ?? false,
      };
    }),
  });
}

/** Save one team member's scheduling profile. */
export async function PUT(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  if (tenant.impersonating && !tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only session." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { userId?: unknown; profile?: unknown; name?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const team = await loadTeam(tenant.businessId);
  const member = team.members.find((m) => m.userId === userId);
  if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  const parsed = parseTeamProfile(body?.profile);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const saved = await saveTeamProfile(tenant.businessId, userId, parsed.fields);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });

  if (typeof body?.name === "string" && body.name.trim() && body.name.trim() !== member.name) {
    const db = await createTenantServiceClient(tenant.businessId);
    await db.raw.from("profiles").update({ full_name: body.name.trim().slice(0, 120) }).eq("id", userId).eq("business_id", tenant.businessId);
  }
  return NextResponse.json({ ok: true });
}

/** Calendar color for one team member (Shoot Calendar → Team). Owner/admin; shared business-wide. */
async function patchTeamColor(body: { teamColor?: { userId?: unknown; color?: unknown } } | null, businessId: string, actorId: string) {
  const userId = typeof body?.teamColor?.userId === "string" ? body.teamColor.userId : "";
  const color = body?.teamColor?.color;
  if (color !== null && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
    return NextResponse.json({ error: "Use a hex color like #2563EB." }, { status: 400 });
  }
  const team = await loadTeam(businessId);
  if (!team.members.some((m) => m.userId === userId)) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  const settings = await getAppSettings(businessId);
  const teamColors = { ...settings.booking.teamColors };
  if (color === null) delete teamColors[userId];
  else teamColors[userId] = (color as string).toUpperCase();
  await saveAppSettings({ booking: { ...settings.booking, teamColors } }, actorId, businessId);
  return NextResponse.json({ ok: true, teamColors });
}

/**
 * Update a member's calendar color ({ teamColor }) or just their contact details (title, phone,
 * base address) without touching the
 * rest of their scheduling profile. Used by Settings → Staff & Permissions (invite + edit).
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  if (tenant.impersonating && !tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only session." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    displayTitle?: unknown;
    phone?: unknown;
    baseAddress?: unknown;
    teamColor?: { userId?: unknown; color?: unknown };
  } | null;
  // Shoot Calendar → Team sends { teamColor }; Staff & Permissions sends contact details.
  if (body?.teamColor) return patchTeamColor(body, tenant.businessId, auth.profile.id);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const team = await loadTeam(tenant.businessId);
  const member = team.members.find((m) => m.userId === userId);
  if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

  const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.slice(0, max) : fallback);
  const fields = {
    ...member.profile,
    displayTitle: str(body?.displayTitle, 80, member.profile.displayTitle),
    phone: str(body?.phone, 40, member.profile.phone),
    baseAddress: str(body?.baseAddress, 300, member.profile.baseAddress),
  };
  const saved = await saveTeamProfile(tenant.businessId, userId, fields);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json({ ok: true });
}
