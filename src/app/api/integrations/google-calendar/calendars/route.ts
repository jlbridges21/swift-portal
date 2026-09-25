import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import {
  listCalendarsForViewer,
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
