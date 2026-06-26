import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  isGoogleCalendarConfigured,
  listGoogleCalendars,
  setGoogleCalendarId,
} from "@/lib/google-calendar";

export async function GET() {
  try {
    await requireAdmin();
    const conn = await getGoogleCalendarConnection();
    const calendars = conn ? await listGoogleCalendars() : [];

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
    await requireAdmin();
    const body = await request.json();

    if (!body.calendar_id) {
      return NextResponse.json({ error: "calendar_id required" }, { status: 400 });
    }

    await setGoogleCalendarId(body.calendar_id, body.calendar_summary ?? body.calendar_id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await disconnectGoogleCalendar();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
