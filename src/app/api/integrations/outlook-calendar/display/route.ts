import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { setOutlookDisplayColor, setOutlookDisplayHidden } from "@/lib/outlook-calendar";

/** Save which Outlook calendars show on the Shoot Calendar, or one calendar's color (owner only). */
export async function PATCH(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Only the business owner can change Outlook calendars." }, { status: 403 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (tenant.impersonating && !tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    hiddenCalendarIds?: unknown;
    color?: { key?: unknown; value?: unknown } | null;
  };
  try {
    if (body.color && typeof body.color === "object") {
      const key = typeof body.color.key === "string" ? body.color.key : "";
      const value = body.color.value === null ? null : typeof body.color.value === "string" ? body.color.value : undefined;
      if (!key || value === undefined) return NextResponse.json({ error: "color.key and color.value required" }, { status: 400 });
      const colors = await setOutlookDisplayColor(tenant.businessId, key, value);
      return NextResponse.json({ colors });
    }
    if (!Array.isArray(body.hiddenCalendarIds)) {
      return NextResponse.json({ error: "hiddenCalendarIds required" }, { status: 400 });
    }
    const hidden = body.hiddenCalendarIds.filter((id): id is string => typeof id === "string");
    const hiddenCalendarIds = await setOutlookDisplayHidden(tenant.businessId, hidden);
    return NextResponse.json({ hiddenCalendarIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save";
    const missing = /display_(hidden|calendar)|column/i.test(message);
    return NextResponse.json(
      { error: missing ? "Apply database migration v138 to save Outlook calendar choices." : message },
      { status: 400 }
    );
  }
}
