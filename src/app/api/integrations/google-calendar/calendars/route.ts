import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import {
  listCalendarsForViewer,
  setViewerCalendarColor,
  setViewerHiddenCalendarIds,
} from "@/lib/google-calendar";

function ownerOnly() {
  return NextResponse.json(
    { error: "Only the business owner can view Google calendars." },
    { status: 403 }
  );
}

export async function GET() {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  try {
    const listed = await listCalendarsForViewer(tenant.businessId, profile.id);
    return NextResponse.json(listed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list calendars";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const body = await request.json().catch(() => ({}));
  const color =
    body.color && typeof body.color === "object"
      ? (body.color as { key?: unknown; value?: unknown })
      : null;
  if (color) {
    const key = typeof color.key === "string" ? color.key : "";
    const value = color.value === null ? null : typeof color.value === "string" ? color.value : undefined;
    if (!key || value === undefined) {
      return NextResponse.json({ error: "color.key and color.value required" }, { status: 400 });
    }
    try {
      const calendarColors = await setViewerCalendarColor(tenant.businessId, profile.id, key, value);
      return NextResponse.json({ calendarColors });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save color";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  const hidden = Array.isArray(body.hiddenCalendarIds)
    ? body.hiddenCalendarIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  if (!hidden) {
    return NextResponse.json({ error: "hiddenCalendarIds required" }, { status: 400 });
  }
  try {
    const hiddenCalendarIds = await setViewerHiddenCalendarIds(tenant.businessId, profile.id, hidden);
    return NextResponse.json({ hiddenCalendarIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save calendars";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
