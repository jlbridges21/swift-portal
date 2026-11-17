import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getGoogleCalendarPublicStatus } from "@/lib/google-calendar";
import { bookingSchemaReady, loadServiceBookingRules } from "@/lib/booking/server";
import { businessAddress, loadTeam, parseTeamProfile, resolveMember, saveTeamProfile } from "@/lib/booking/team";
import { routesConfigured } from "@/lib/booking/routes";
import { getAppSettings } from "@/lib/app-settings";
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

  const [settings, schemaReady, team, google, rules, services] = await Promise.all([
    getAppSettings(businessId),
    bookingSchemaReady(db),
    loadTeam(businessId),
    getGoogleCalendarPublicStatus(businessId).catch(() => null),
    loadServiceBookingRules(db),
    listBusinessServices(businessId),
  ]);

  return NextResponse.json({
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
