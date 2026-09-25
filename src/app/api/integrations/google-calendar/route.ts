import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarPublicStatus,
  updateReadCalendars,
  updateSelectedCalendar,
} from "@/lib/google-calendar";

function ownerOnly() {
  return NextResponse.json(
    { error: "Only the business owner can connect or disconnect Google Calendar." },
    { status: 403 }
  );
}

export async function GET() {
  const profile = await requireAdmin({ area: "calendar" }).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const status = await getGoogleCalendarPublicStatus(tenant.businessId);
  if (!isOwnerAdmin(profile)) {
    return NextResponse.json({
      configured: status.configured,
      connected: status.connected,
      status: status.status,
      calendarSummary: null,
      attentionCount: 0,
      calendars: [],
      email: null,
      calendarId: null,
      lastError: null,
    });
  }
  return NextResponse.json(status);
}

export async function PATCH(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const body = await request.json().catch(() => ({}));
  const calendarId = typeof body.calendarId === "string" ? body.calendarId.trim() : "";
  const readCalendarIds = Array.isArray(body.readCalendarIds)
    ? body.readCalendarIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  if (!calendarId && !readCalendarIds) {
    return NextResponse.json({ error: "calendarId or readCalendarIds required" }, { status: 400 });
  }
  try {
    const saved: { calendarId?: string; calendarSummary?: string; readCalendarIds?: string[] } = {};
    if (calendarId) Object.assign(saved, await updateSelectedCalendar(tenant.businessId, calendarId));
    if (readCalendarIds) Object.assign(saved, await updateReadCalendars(tenant.businessId, readCalendarIds));
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save calendar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const result = await disconnectGoogleCalendar(tenant.businessId);
  return NextResponse.json({
    disconnected: true,
    revoked: result.revoked,
    revokeStatus: result.revokeStatus,
  });
}
