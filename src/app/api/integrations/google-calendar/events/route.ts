import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { loadViewerGoogleWindow } from "@/lib/google-calendar";
import { externalEventsVisibleTo } from "@/lib/google-calendar-pull";

const MAX_SPAN_MS = 120 * 24 * 60 * 60 * 1000;

function ownerOnly() {
  return NextResponse.json(
    { error: "External Google events are visible to the business owner only." },
    { status: 403 }
  );
}

export async function GET(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) return ownerOnly();
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const start = new Date(from);
  const end = new Date(to);
  const span = end.getTime() - start.getTime();
  if (!from || !to || Number.isNaN(span) || span <= 0 || span > MAX_SPAN_MS) {
    return NextResponse.json({ error: "from and to must be a range of at most 120 days." }, { status: 400 });
  }

  // Optional: only these calendars (e.g. one the viewer just turned back on). Ids are checked
  // against the connected account's own calendar list inside loadViewerGoogleWindow.
  const only = url.searchParams.get("calendars");
  const onlyCalendarIds = only
    ? only
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id.length <= 256)
        .slice(0, 50)
    : undefined;

  const loaded = await loadViewerGoogleWindow(tenant.businessId, profile.id, start.toISOString(), end.toISOString(), {
    onlyCalendarIds,
  });
  return NextResponse.json({
    connected: loaded.connected,
    events: externalEventsVisibleTo(profile.role, loaded.events),
    loadedCalendarIds: loaded.loadedCalendarIds,
    degraded: loaded.degraded,
    timeZone: loaded.timeZone,
  });
}
