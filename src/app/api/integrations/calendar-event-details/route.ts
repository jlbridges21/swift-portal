import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import {
  deleteGoogleEventFromCalendar,
  getGoogleEventDetails,
  resolveBusinessTimeZone,
  updateGoogleEvent,
} from "@/lib/google-calendar";
import {
  deleteOutlookEventFromCalendar,
  getOutlookEventDetails,
  OUTLOOK_DISPLAY_PREFIX,
  updateOutlookEvent,
} from "@/lib/outlook-calendar";
import { parseExternalEventUpdate } from "@/lib/external-event-details";

/**
 * One Google or Outlook event opened on the Shoot Calendar. Owner only, like the event lists.
 * Read from and written to the provider live; nothing is stored in ShootPortal.
 *
 * GET    ?calendarId&eventId                   → { details }
 * PATCH  { calendarId, eventId, scope, notify, title?, description?, location?, allDay?, start?, end?, attendees?, meeting? }
 * DELETE ?calendarId&eventId&scope=this|all&notify=1|0
 */
async function owner(write: boolean) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return { error: NextResponse.json({ error: "Calendar events are visible to the business owner only." }, { status: 403 }) } as const;
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) } as const;
  if (write && tenant.impersonating && !tenant.allowWrites) {
    return { error: NextResponse.json({ error: "Read-only impersonation." }, { status: 403 }) } as const;
  }
  return { profile, tenant } as const;
}

function ids(calendarIdRaw: unknown, eventIdRaw: unknown) {
  const calendarId = typeof calendarIdRaw === "string" ? calendarIdRaw.trim() : "";
  const eventId = typeof eventIdRaw === "string" ? eventIdRaw.trim() : "";
  if (!calendarId || !eventId || calendarId.length > 600 || eventId.length > 600) return null;
  return { calendarId, eventId, outlook: calendarId.startsWith(OUTLOOK_DISPLAY_PREFIX) };
}

async function businessTimeZone(businessId: string) {
  const settings = await getAppSettings(businessId);
  return resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
}

export async function PATCH(request: Request) {
  const ctx = await owner(true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const target = ids(body.calendarId, body.eventId);
  if (!target) return NextResponse.json({ error: "calendarId and eventId are required." }, { status: 400 });
  let update;
  try {
    update = parseExternalEventUpdate(body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid change." }, { status: 400 });
  }
  try {
    const timeZone = await businessTimeZone(ctx.tenant.businessId);
    if (target.outlook) await updateOutlookEvent(ctx.tenant.businessId, target.calendarId, target.eventId, update, timeZone);
    else await updateGoogleEvent(ctx.tenant.businessId, target.calendarId, target.eventId, update, timeZone);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save the change." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await owner(true);
  if ("error" in ctx) return ctx.error;
  const url = new URL(request.url);
  const target = ids(url.searchParams.get("calendarId"), url.searchParams.get("eventId"));
  if (!target) return NextResponse.json({ error: "calendarId and eventId are required." }, { status: 400 });
  const opts = { scope: url.searchParams.get("scope") === "all" ? ("all" as const) : ("this" as const), notify: url.searchParams.get("notify") !== "0" };
  try {
    if (target.outlook) await deleteOutlookEventFromCalendar(ctx.tenant.businessId, target.calendarId, target.eventId, opts);
    else await deleteGoogleEventFromCalendar(ctx.tenant.businessId, target.calendarId, target.eventId, opts);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't delete the event." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const ctx = await owner(false);
  if ("error" in ctx) return ctx.error;
  const { tenant } = ctx;
  const url = new URL(request.url);
  const target = ids(url.searchParams.get("calendarId"), url.searchParams.get("eventId"));
  if (!target) return NextResponse.json({ error: "calendarId and eventId are required." }, { status: 400 });
  const { calendarId, eventId } = target;
  const outlook = target.outlook;
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
