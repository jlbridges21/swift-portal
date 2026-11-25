import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getGoogleEventDetails } from "@/lib/google-calendar";
import { getOutlookEventDetails, OUTLOOK_DISPLAY_PREFIX } from "@/lib/outlook-calendar";

/**
 * GET ?calendarId&eventId → { details } for one Google or Outlook event opened on the Shoot
 * Calendar. Owner only, like the event lists. Read from the provider live; nothing is stored.
 */
export async function GET(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Calendar events are visible to the business owner only." }, { status: 403 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const url = new URL(request.url);
  const calendarId = (url.searchParams.get("calendarId") || "").trim();
  const eventId = (url.searchParams.get("eventId") || "").trim();
  if (!calendarId || !eventId || calendarId.length > 600 || eventId.length > 600) {
    return NextResponse.json({ error: "calendarId and eventId are required." }, { status: 400 });
  }
  const outlook = calendarId.startsWith(OUTLOOK_DISPLAY_PREFIX);
  try {
    const details = outlook
      ? await getOutlookEventDetails(tenant.businessId, calendarId, eventId)
      : await getGoogleEventDetails(tenant.businessId, calendarId, eventId);
    return NextResponse.json({ details }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[calendar-event-details] failed", {
      provider: outlook ? "outlook" : "google",
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return NextResponse.json(
      { error: `Couldn't load the details from ${outlook ? "Outlook" : "Google"}.` },
      { status: 502 }
    );
  }
}
