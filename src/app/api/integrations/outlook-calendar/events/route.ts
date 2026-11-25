import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";
import { loadOutlookDisplayWindow } from "@/lib/outlook-calendar";

const MAX_SPAN_MS = 120 * 24 * 60 * 60 * 1000;

/** Outlook calendars + events for the Shoot Calendar (owner only, read-only display). */
export async function GET(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Outlook events are visible to the business owner only." }, { status: 403 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("from") || "");
  const end = new Date(url.searchParams.get("to") || "");
  const span = end.getTime() - start.getTime();
  if (Number.isNaN(span) || span <= 0 || span > MAX_SPAN_MS) {
    return NextResponse.json({ error: "from and to must be a range of at most 120 days." }, { status: 400 });
  }
  const settings = await getAppSettings(tenant.businessId);
  const timeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
  try {
    const window = await loadOutlookDisplayWindow(tenant.businessId, start.toISOString(), end.toISOString(), timeZone);
    return NextResponse.json({ ...window, timeZone });
  } catch (err) {
    console.error("[outlook-calendar] display window failed", err instanceof Error ? err.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "Outlook events couldn't load." }, { status: 502 });
  }
}
