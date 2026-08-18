import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  isGoogleCalendarConfigured,
  listGoogleCalendars,
  setGoogleCalendarId,
} from "@/lib/google-calendar";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const conn = await getGoogleCalendarConnection(tenant.businessId);
    const calendars = conn ? await listGoogleCalendars(tenant.businessId) : [];

    return NextResponse.json({
      configured: isGoogleCalendarConfigured(),
      connected: Boolean(conn),
      email: conn?.connected_email ?? null,
      calendarId: conn?.calendar_id ?? null,
      calendarSummary: conn?.calendar_summary ?? null,
      calendars,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const body = await request.json();

    if (!body.calendar_id) {
      return NextResponse.json({ error: "calendar_id required" }, { status: 400 });
    }

    await setGoogleCalendarId(
      tenant.businessId,
      body.calendar_id,
      body.calendar_summary ?? body.calendar_id
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    await disconnectGoogleCalendar(tenant.businessId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
