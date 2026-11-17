import { NextResponse } from "next/server";
import { resolveBookingAccess, type BookingAccess } from "@/lib/booking/access";
import {
  checkStart,
  computeAvailability,
  createHold,
  effectiveSchedulingStatus,
  instantBookingActive,
  loadBookingContext,
  loadProjectBookingFacts,
  type BookingContext,
  type BookingProjectFacts,
} from "@/lib/booking/server";
import { cancelAppointment, clientChangeAllowed, confirmAppointment, reassignAppointment } from "@/lib/booking/actions";
import {
  avatarFor,
  coverUrlFor,
  loadEstimateSummary,
  loadRouteContext,
  teamOptionsFor,
} from "@/lib/booking/details";
import { isDayKey } from "@/lib/booking/time";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";
import { isTeamBusiness } from "@/lib/booking/team";
import { routesConfigured } from "@/lib/booking/routes";
import { offerTimes } from "@/lib/booking/offers";
import { bookingPagePath, sealBookingToken } from "@/lib/booking/token";
import { getBusinessPortalOriginById } from "@/lib/portal-url";

/**
 * Instant Booking API. One endpoint, action-dispatched; every action resolves access first
 * (booking-link token, signed-in client, or team member) and re-reads all state server-side.
 *
 * Client actions: availability · hold · confirm · skip · cancel
 * Business actions: availability · check · schedule · reassign · cancel · details · offer
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const access = await resolveBookingAccess({ token: body.b, projectId: body.projectId });
  if (!access) return NextResponse.json({ error: "This booking link is invalid or has expired." }, { status: 404 });

  const ctx = await loadBookingContext(access.businessId);
  const facts = await loadProjectBookingFacts(ctx, access.projectId);
  if (!facts) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  try {
    switch (action) {
      case "availability":
        return availability(ctx, facts, access, body);
      case "hold":
        return hold(ctx, facts, access, body);
      case "confirm":
        return confirm(ctx, facts, access, body);
      case "skip":
        return skip(ctx, facts, access);
      case "cancel":
        return cancel(ctx, facts, access, body);
      case "check":
        return businessOnly(access, () => check(ctx, facts, body));
      case "schedule":
        return businessOnly(access, () => schedule(ctx, facts, access, body));
      case "reassign":
        return businessOnly(access, () => reassign(ctx, facts, access, body));
      case "details":
        return businessOnly(access, () => details(ctx, facts, access));
      case "offer":
        return businessOnly(access, () => offer(ctx, facts, access, body));
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("[booking] action failed", { action, error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

function businessOnly(access: BookingAccess, run: () => Promise<Response>): Promise<Response> | Response {
  if (access.role !== "business") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return run();
}

function parseStart(raw: unknown): number | null {
  const ms = Date.parse(String(raw ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function userIdOrNull(ctx: BookingContext, raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw === "any") return null;
  return ctx.team.some((m) => m.userId === raw) ? raw : null;
}

async function availability(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (access.role === "client" && !instantBookingActive(ctx)) {
    return NextResponse.json({ error: "Online booking isn't available for this project." }, { status: 403 });
  }
  const from = isDayKey(body.from) ? body.from : null;
  const to = isDayKey(body.to) ? body.to : null;
  if (!from || !to) return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required." }, { status: 400 });
  const staffChoice = userIdOrNull(ctx, body.staff);
  const clientMayChoose = access.role === "business" || ctx.booking.clientChoosesStaff;
  const reschedulingId = facts.appointment?.status === "confirmed" ? facts.appointment.id : null;
  const result = await computeAvailability(ctx, {
    facts,
    fromDay: from,
    toDay: to,
    onlyUserIds: staffChoice && clientMayChoose ? [staffChoice] : undefined,
    excludeAppointmentId: reschedulingId,
    includeAllTeam: access.role === "business" && body.allTeam === true,
  });
  const team = isTeamBusiness(ctx.team);
  const showStaff = access.role === "business" || (team && ctx.booking.clientChoosesStaff);
  return NextResponse.json({
    ...result,
    // Clients only see people when the business lets them choose.
    staff: showStaff ? result.staff : [],
    slots: result.slots.map((s) => ({ start: s.start, end: s.end, dayKey: s.dayKey, userId: showStaff ? s.userId : null, optimized: s.cost < 0.25 })),
    recommendedUserId: showStaff ? result.recommendedUserId : null,
    mode: ctx.booking.mode,
    team,
    clientChoosesStaff: ctx.booking.clientChoosesStaff,
    showUnavailableStaff: ctx.booking.showUnavailableStaff,
    slotSort: ctx.booking.slotSort,
    rescheduling: Boolean(reschedulingId),
  });
}

async function hold(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (!instantBookingActive(ctx)) return NextResponse.json({ error: "Online booking is off." }, { status: 403 });
  const start = parseStart(body.start);
  if (start == null) return NextResponse.json({ error: "Choose a time." }, { status: 400 });
  const chosen = access.role === "business" || ctx.booking.clientChoosesStaff ? userIdOrNull(ctx, body.userId) : null;
  const check = await checkStart(ctx, facts, start, {
    userId: chosen,
    excludeAppointmentId: facts.appointment?.status === "confirmed" ? facts.appointment.id : null,
  });
  if (!check.chosen) {
    return NextResponse.json({ error: "That time was just taken. Please choose another time.", code: "unavailable" }, { status: 409 });
  }
  const held = await createHold(ctx, facts, check.chosen.userId, start);
  const person = isTeamBusiness(ctx.team) ? await avatarFor(check.chosen.userId) : null;
  return NextResponse.json({
    holdId: held?.id ?? null,
    expiresAt: held?.expiresAt ?? null,
    userId: check.chosen.userId,
    photographer: person,
    start: new Date(start).toISOString(),
    end: new Date(check.chosen.evaluation.end).toISOString(),
  });
}

async function confirm(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (access.role !== "client") {
    return NextResponse.json({ error: "Use schedule for business bookings." }, { status: 400 });
  }
  if (!instantBookingActive(ctx)) return NextResponse.json({ error: "Online booking is off." }, { status: 403 });
  if (facts.appointment?.status === "confirmed") {
    const allowed = clientChangeAllowed(ctx, facts, "reschedule");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
  }
  const start = parseStart(body.start);
  if (start == null) return NextResponse.json({ error: "Choose a time." }, { status: 400 });
  const userId = ctx.booking.clientChoosesStaff ? userIdOrNull(ctx, body.userId) : null;
  const result = await confirmAppointment(ctx, facts, {
    startMs: start,
    userId,
    source: "instant",
    actor: access.actor,
    holdId: typeof body.holdId === "string" ? body.holdId : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.code === "error" ? 500 : 409 });
  }
  return NextResponse.json(result);
}

async function skip(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess) {
  if (facts.appointment?.status === "confirmed") return NextResponse.json({ ok: true, alreadyScheduled: true });
  if (ctx.schemaReady) {
    await ctx.db.from("projects").update({ scheduling_status: "unscheduled" }).eq("id", facts.projectId);
  }
  await logProjectActivity("scheduling_skipped", "Client asked to be contacted to schedule the shoot", {
    businessId: ctx.businessId,
    projectId: facts.projectId,
    userId: access.actor.userId,
    visibility: "both",
    idempotencyKey: `booking-skip:${facts.projectId}`,
  });
  await notifyAdmins({
    businessId: ctx.businessId,
    projectId: facts.projectId,
    type: "schedule_change_requested",
    eventKey: "shoot_time_proposed",
    title: "Client needs a shoot time",
    body: `${facts.clientName} asked you to follow up to schedule ${facts.propertyAddress ?? facts.projectName}.`,
    link: `/admin/projects/${facts.projectId}`,
    idempotencyKey: `booking-skip:${facts.projectId}`,
  });
  return NextResponse.json({ ok: true });
}

async function cancel(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (access.role === "client") {
    const allowed = clientChangeAllowed(ctx, facts, "cancel");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
  } else if (!access.canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await cancelAppointment(ctx, facts, {
    actor: access.actor,
    reason: typeof body.reason === "string" ? body.reason : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}

async function check(ctx: BookingContext, facts: BookingProjectFacts, body: Record<string, unknown>) {
  const start = parseStart(body.start);
  if (start == null) return NextResponse.json({ error: "start is required." }, { status: 400 });
  const result = await checkStart(ctx, facts, start, {
    userId: userIdOrNull(ctx, body.userId),
    excludeAppointmentId: facts.appointment?.status === "confirmed" ? facts.appointment.id : null,
    includeAllTeam: true,
    ignoreNotice: true,
  });
  return NextResponse.json({
    ok: Boolean(result.chosen),
    recommendedUserId: result.chosen?.userId ?? null,
    durationMinutes: facts.durationMinutes,
    ranked: result.ranked.map((r) => ({
      ...r,
      violations: r.violations.map((v) => (v in VIOLATIONS ? VIOLATIONS[v as keyof typeof VIOLATIONS] : v)),
    })),
  });
}

async function schedule(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (!access.canManage) return NextResponse.json({ error: "You don't have permission to schedule shoots." }, { status: 403 });
  const start = parseStart(body.start);
  if (start == null) return NextResponse.json({ error: "Choose a date and time." }, { status: 400 });
  const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
  if (overrideReason && !access.canOverride) {
    return NextResponse.json({ error: "Only an owner or admin can override scheduling conflicts." }, { status: 403 });
  }
  const result = await confirmAppointment(ctx, facts, {
    startMs: start,
    userId: userIdOrNull(ctx, body.userId),
    source: "manual",
    actor: access.actor,
    override: overrideReason && body.confirmOverride === true ? { reason: overrideReason } : null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code, violations: result.violations ?? [], canOverride: access.canOverride },
      { status: result.code === "error" ? 500 : 409 }
    );
  }
  return NextResponse.json(result);
}

async function reassign(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (!access.canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = userIdOrNull(ctx, body.userId);
  if (!userId) return NextResponse.json({ error: "Choose a team member." }, { status: 400 });
  const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
  if (overrideReason && !access.canOverride) return NextResponse.json({ error: "Only an owner or admin can override." }, { status: 403 });
  const result = await reassignAppointment(ctx, facts, {
    userId,
    actor: access.actor,
    override: overrideReason && body.confirmOverride === true ? { reason: overrideReason } : null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, violations: result.violations ?? [], canOverride: access.canOverride },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true });
}

async function offer(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess, body: Record<string, unknown>) {
  if (!access.canManage) return NextResponse.json({ error: "You don't have permission to schedule shoots." }, { status: 403 });
  const starts = Array.isArray(body.starts) ? body.starts.map(parseStart).filter((s): s is number => s != null) : [];
  const result = await offerTimes(ctx, facts, {
    starts,
    userId: userIdOrNull(ctx, body.userId),
    message: typeof body.message === "string" ? body.message : null,
    actor: access.actor,
  });
  if (!result.ok) return NextResponse.json({ error: result.message, problems: result.problems ?? [] }, { status: result.status });
  return NextResponse.json({ ok: true, offered: result.offered });
}

async function clientBookingLink(ctx: BookingContext, facts: BookingProjectFacts): Promise<string | null> {
  if (!facts.clientId) return null;
  try {
    const origin = await getBusinessPortalOriginById(ctx.businessId);
    const token = sealBookingToken({ businessId: ctx.businessId, clientId: facts.clientId, projectId: facts.projectId });
    return `${origin.replace(/\/$/, "")}${bookingPagePath(token)}`;
  } catch {
    return null;
  }
}

async function details(ctx: BookingContext, facts: BookingProjectFacts, access: BookingAccess) {
  const appt = facts.appointment;
  const [estimate, cover] = await Promise.all([loadEstimateSummary(ctx, facts.projectId), coverUrlFor(ctx, facts.projectId)]);
  const base = {
    project: {
      id: facts.projectId,
      name: facts.projectName,
      address: facts.propertyAddress,
      clientName: facts.clientName,
      clientEmail: facts.clientEmail,
      clientPhone: facts.clientPhone,
      services: facts.serviceNames,
      durationMinutes: facts.durationMinutes,
      coverUrl: cover,
      travelMiles: facts.travelMiles,
      outsideServiceArea: facts.outsideServiceArea,
    },
    schedulingStatus: effectiveSchedulingStatus(facts),
    estimate,
    timeZone: ctx.timeZone,
    /** Everyone who can be scheduled by the business (for pickers before anything is booked). */
    teamMembers: ctx.team.map((m) => ({ userId: m.userId, name: m.name })),
    /** Personal booking page for the project's client (texted or emailed by the business). */
    bookingLink: access.canManage && instantBookingActive(ctx) ? await clientBookingLink(ctx, facts) : null,
    canManage: access.canManage,
    canOverride: access.canOverride,
    schemaReady: ctx.schemaReady,
    routesConfigured: routesConfigured(),
    team: isTeamBusiness(ctx.team),
  };
  if (!appt || appt.status !== "confirmed") {
    return NextResponse.json({ ...base, appointment: null, route: null, teamOptions: [] });
  }
  const [route, teamOptions, assignee] = await Promise.all([
    loadRouteContext(ctx, facts, appt),
    ctx.schemaReady ? teamOptionsFor(ctx, facts, appt) : Promise.resolve([]),
    avatarFor(appt.assignedUserId),
  ]);
  return NextResponse.json({
    ...base,
    appointment: {
      id: appt.id,
      start: new Date(appt.start).toISOString(),
      end: new Date(appt.end).toISOString(),
      source: appt.source,
      assignedUserId: appt.assignedUserId,
      assignee,
      conflictOverride: appt.conflictOverride,
      googleSyncStatus: appt.googleSyncStatus,
    },
    route: { ...route, legIn: { ...route.legIn, polyline: undefined }, legOut: { ...route.legOut, polyline: undefined } },
    mapUrl: routesConfigured() && facts.propertyAddress ? `/api/booking/map?proposal=${appt.id}&projectId=${facts.projectId}` : null,
    teamOptions,
  });
}

const VIOLATIONS = {
  not_working_day: "Not a working day",
  outside_hours: "Outside working hours",
  too_soon: "Inside minimum notice",
  too_far_ahead: "Beyond booking window",
  max_per_day: "Daily shoot limit reached",
  conflict_appointment: "Overlaps another shoot",
  conflict_calendar: "Busy on Google Calendar",
  conflict_hold: "Being booked by another client",
  travel_from_previous: "Not enough drive time from previous shoot",
  travel_to_next: "Not enough drive time to next shoot",
  start_of_day_travel: "Drive would start before working hours",
  end_of_day_travel: "Return drive ends after working hours",
  calendar_unavailable: "Google Calendar unavailable",
} as const;
