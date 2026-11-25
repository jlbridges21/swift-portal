import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isActiveStaff, isOwnerAdmin, staffCan } from "@/lib/staff-access";
import {
  CalendarEventsNotReady,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEventInput,
} from "@/lib/calendar-events";

/**
 * Shoot Calendar events without a project (v139).
 * Owners/admins see and manage every event; staff with scheduling permission manage their own.
 *
 * GET    ?from&to          → { ready, events }
 * POST   { title, description, location, start, end, assignedUserId, serviceId }
 * PATCH  { id, ...same fields }
 * DELETE ?id=
 */
async function actor() {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const tenant = await getTenantContext();
  if (!tenant || tenant.isSharedViewer) return { error: missingTenantResponse(profile.role) } as const;
  const admin = isOwnerAdmin(profile);
  const staff = isActiveStaff(profile) && (staffCan(profile, "scheduling.confirm") || staffCan(profile, "scheduling.propose"));
  if (!admin && !staff) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  const readOnly = Boolean(tenant.impersonating && !tenant.allowWrites);
  return { profile, tenant, admin, readOnly } as const;
}

function inputFrom(body: Record<string, unknown>, admin: boolean, selfId: string): CalendarEventInput {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const input: CalendarEventInput = {};
  if ("title" in body) input.title = str(body.title) ?? "";
  if ("description" in body) input.description = str(body.description) ?? null;
  if ("location" in body) input.location = str(body.location) ?? null;
  if ("start" in body) input.startIso = str(body.start);
  if ("end" in body) input.endIso = str(body.end);
  if ("serviceId" in body) input.serviceId = str(body.serviceId) || null;
  if ("assignedUserId" in body) {
    const requested = str(body.assignedUserId) || selfId;
    // Staff can only put events on their own calendar.
    input.assignedUserId = admin ? requested : selfId;
  }
  return input;
}

function failure(err: unknown) {
  if (err instanceof CalendarEventsNotReady) return NextResponse.json({ error: err.message, notReady: true }, { status: 503 });
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 400 });
}

export async function GET(request: Request) {
  const ctx = await actor();
  if ("error" in ctx) return ctx.error;
  const url = new URL(request.url);
  const from = Date.parse(url.searchParams.get("from") || "");
  const to = Date.parse(url.searchParams.get("to") || "");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 120 * 86_400_000) {
    return NextResponse.json({ error: "from and to must be a range of at most 120 days." }, { status: 400 });
  }
  const result = await listCalendarEvents(ctx.tenant.businessId, new Date(from).toISOString(), new Date(to).toISOString(), {
    onlyUserId: ctx.admin ? undefined : ctx.profile.id,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const ctx = await actor();
  if ("error" in ctx) return ctx.error;
  if (ctx.readOnly) return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const input = inputFrom({ assignedUserId: ctx.profile.id, ...body }, ctx.admin, ctx.profile.id);
    const event = await createCalendarEvent(ctx.tenant.businessId, ctx.profile.id, input);
    return NextResponse.json({ event });
  } catch (err) {
    return failure(err);
  }
}

export async function PATCH(request: Request) {
  const ctx = await actor();
  if ("error" in ctx) return ctx.error;
  if (ctx.readOnly) return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const current = await getCalendarEvent(ctx.tenant.businessId, id);
    if (!current) return NextResponse.json({ error: "This event was removed. Refresh and try again." }, { status: 404 });
    if (!ctx.admin && current.assigned_user_id !== ctx.profile.id) {
      return NextResponse.json({ error: "You can only change your own events." }, { status: 403 });
    }
    const event = await updateCalendarEvent(ctx.tenant.businessId, id, inputFrom(body, ctx.admin, ctx.profile.id));
    return NextResponse.json({ event });
  } catch (err) {
    return failure(err);
  }
}

export async function DELETE(request: Request) {
  const ctx = await actor();
  if ("error" in ctx) return ctx.error;
  if (ctx.readOnly) return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const current = await getCalendarEvent(ctx.tenant.businessId, id);
    if (!current) return NextResponse.json({ ok: true });
    if (!ctx.admin && current.assigned_user_id !== ctx.profile.id) {
      return NextResponse.json({ error: "You can only delete your own events." }, { status: 403 });
    }
    await deleteCalendarEvent(ctx.tenant.businessId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}
