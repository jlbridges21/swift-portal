import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import {
  disconnectOutlookCalendar,
  getOutlookCalendarPublicStatus,
  updateOutlookSettings,
} from "@/lib/outlook-calendar";

function ownerOnly() {
  return NextResponse.json({ error: "Only the business owner can connect or disconnect Outlook Calendar." }, { status: 403 });
}

export async function GET() {
  const profile = await requireAdmin({ area: "calendar" }).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const status = await getOutlookCalendarPublicStatus(tenant.businessId);
  if (!isOwnerAdmin(profile)) {
    return NextResponse.json({
      ...status,
      email: null,
      calendarId: null,
      calendarName: null,
      busyCalendarIds: [],
      lastError: null,
      attentionCount: 0,
      calendars: [],
      canManage: false,
    });
  }
  return NextResponse.json({ ...status, canManage: true });
}

export async function PATCH(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (tenant.impersonating && !tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { calendarId?: unknown; busyCalendarIds?: unknown };
  const calendarId = typeof body.calendarId === "string" ? body.calendarId.trim() : undefined;
  const busyCalendarIds = Array.isArray(body.busyCalendarIds)
    ? body.busyCalendarIds.filter((id): id is string => typeof id === "string")
    : undefined;
  if (!calendarId && !busyCalendarIds) {
    return NextResponse.json({ error: "calendarId or busyCalendarIds required" }, { status: 400 });
  }
  try {
    const saved = await updateOutlookSettings(tenant.businessId, { calendarId, busyCalendarIds });
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}

export async function DELETE() {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (tenant.impersonating && !tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  }
  try {
    await disconnectOutlookCalendar(tenant.businessId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not disconnect" }, { status: 500 });
  }
  return NextResponse.json({ disconnected: true });
}
