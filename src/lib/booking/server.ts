/**
 * Instant Booking — server orchestration. Gathers everything the pure engine needs
 * (settings, team, services, appointments, Google busy times, holds, drive times) and turns
 * engine output into API-shaped availability. Every external dependency fails soft.
 */

import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings, type AppSettings } from "@/lib/app-settings";
import { getGoogleCalendarAccess, getMemberGoogleAccess, listMemberConnections, resolveBusinessTimeZone } from "@/lib/google-calendar";
import { listGoogleEvents } from "@/lib/google-calendar-pull";
import { loadProjectServiceLinks } from "@/lib/project-services";
import {
  combinedDuration,
  type BookingSettings,
} from "@/lib/booking/settings";
import {
  evaluateStart,
  mergeSlotsAcrossStaff,
  qualificationFit,
  rankStaffForStart,
  slotsForStaff,
  sortSlots,
  type BusyInterval,
  type EngineAppointment,
  type EngineInput,
  type EngineSlot,
  type EngineStaff,
  type SlotEvaluation,
} from "@/lib/booking/engine";
import { TravelTable } from "@/lib/booking/routes";
import { addDaysToKey, dayKeysBetween, zonedParts } from "@/lib/booking/time";
import {
  bookableMembers,
  businessAddress,
  loadTeam,
  resolveMember,
  type ResolvedTeamMember,
  type TeamMember,
} from "@/lib/booking/team";
import { decideServiceArea, priceTravel, type ServiceAreaDecision } from "@/lib/booking/travel-pricing";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const HOLD_TTL_MS = 10 * MINUTE;
/** Drive time assumed when Google Routes can't answer. Conservative on purpose. */
const UNKNOWN_TRAVEL_MINUTES = 30;
const MAX_RANGE_DAYS = 62;

// ── schema readiness ───────────────────────────────────────────────────────

let schemaReadyCache: { ready: boolean; at: number } | null = null;

/** True once migration v132 is applied. Cached for a minute (forever once true). */
export async function bookingSchemaReady(db: TenantServiceClient): Promise<boolean> {
  if (schemaReadyCache?.ready) return true;
  if (schemaReadyCache && Date.now() - schemaReadyCache.at < 60_000) return schemaReadyCache.ready;
  const { error } = await db.from("shoot_proposals").select("id, end_at, assigned_user_id, appointment_key").limit(1);
  const ready = !error;
  schemaReadyCache = { ready, at: Date.now() };
  return ready;
}

// ── context ────────────────────────────────────────────────────────────────

export type BookingContext = {
  businessId: string;
  db: TenantServiceClient;
  settings: AppSettings;
  booking: BookingSettings;
  timeZone: string;
  schemaReady: boolean;
  team: TeamMember[];
  bookable: ResolvedTeamMember[];
  ownerId: string | null;
  businessAddress: string | null;
};

export async function loadBookingContext(businessId: string): Promise<BookingContext> {
  const db = await createTenantServiceClient(businessId);
  const [settings, schemaReady, team] = await Promise.all([
    getAppSettings(businessId),
    bookingSchemaReady(db),
    loadTeam(businessId),
  ]);
  return {
    businessId,
    db,
    settings,
    booking: settings.booking,
    timeZone: resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone,
    schemaReady,
    team: team.members,
    bookable: bookableMembers(team.members, settings),
    ownerId: team.members.find((m) => m.role === "owner")?.userId ?? null,
    businessAddress: businessAddress(settings),
  };
}

/** Instant booking is usable: on in settings and the database is ready. */
export function instantBookingActive(ctx: Pick<BookingContext, "booking" | "schemaReady">): boolean {
  return ctx.booking.mode !== "off" && ctx.schemaReady;
}

// ── services ───────────────────────────────────────────────────────────────

export type ServiceBookingRule = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  instantBookingAllowed: boolean;
  outsideRadiusRequiresQuote: boolean;
};

export async function loadServiceBookingRules(db: TenantServiceClient): Promise<Map<string, ServiceBookingRule>> {
  const map = new Map<string, ServiceBookingRule>();
  const full = await db
    .from("business_services")
    .select("id, name, duration_minutes, buffer_minutes, instant_booking_allowed, outside_radius_requires_quote");
  if (!full.error) {
    for (const row of full.data ?? []) {
      map.set(row.id as string, {
        id: row.id as string,
        name: row.name as string,
        durationMinutes: Number(row.duration_minutes ?? 60) || 60,
        bufferMinutes: Number(row.buffer_minutes ?? 0) || 0,
        instantBookingAllowed: row.instant_booking_allowed !== false,
        outsideRadiusRequiresQuote: row.outside_radius_requires_quote === true,
      });
    }
    return map;
  }
  const basic = await db.from("business_services").select("id, name");
  for (const row of basic.data ?? []) {
    map.set(row.id as string, {
      id: row.id as string,
      name: row.name as string,
      durationMinutes: 60,
      bufferMinutes: 0,
      instantBookingAllowed: true,
      outsideRadiusRequiresQuote: false,
    });
  }
  return map;
}

// ── project facts ──────────────────────────────────────────────────────────

export type Appointment = {
  id: string;
  projectId: string;
  start: number;
  end: number;
  status: string;
  assignedUserId: string | null;
  bufferBefore: number;
  bufferAfter: number;
  source: string | null;
  appointmentKey: string;
  googleEventId: string | null;
  googleCalendarId: string | null;
  googleSyncStatus: string | null;
  conflictOverride: boolean;
  cancelledAt: string | null;
};

const APPOINTMENT_COLUMNS =
  "id, project_id, proposed_at, end_at, status, assigned_user_id, buffer_before_minutes, buffer_after_minutes, booking_source, appointment_key, google_event_id, google_calendar_id, google_sync_status, conflict_override, cancelled_at";

export function rowToAppointment(row: Record<string, unknown>, fallbackUserId: string | null): Appointment {
  const start = Date.parse(row.proposed_at as string);
  const end = row.end_at ? Date.parse(row.end_at as string) : start + 60 * MINUTE;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    start,
    end,
    status: String(row.status),
    assignedUserId: (row.assigned_user_id as string | null) ?? fallbackUserId,
    bufferBefore: Number(row.buffer_before_minutes ?? 0),
    bufferAfter: Number(row.buffer_after_minutes ?? 0),
    source: (row.booking_source as string | null) ?? null,
    appointmentKey: (row.appointment_key as string | null) ?? "primary",
    googleEventId: (row.google_event_id as string | null) ?? null,
    googleCalendarId: (row.google_calendar_id as string | null) ?? null,
    googleSyncStatus: (row.google_sync_status as string | null) ?? null,
    conflictOverride: row.conflict_override === true,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
  };
}

export type BookingProjectFacts = {
  projectId: string;
  projectName: string;
  propertyAddress: string | null;
  projectStatus: string;
  schedulingStatus: string | null;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceIds: string[];
  serviceNames: string[];
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  instantAllowedForServices: boolean;
  servicesRequireQuote: boolean;
  travelMiles: number | null;
  outsideServiceArea: boolean;
  appointment: Appointment | null;
  assignedStaffIds: string[];
};

export async function loadProjectBookingFacts(ctx: BookingContext, projectId: string): Promise<BookingProjectFacts | null> {
  const { db } = ctx;
  const baseCols = "id, project_name, property_address, status, client_id, service_type, clients(name, full_name, email, phone)";
  const extended = await db
    .from("projects")
    .select(`${baseCols}, scheduling_status, travel_distance_miles, outside_service_area`)
    .eq("id", projectId)
    .maybeSingle();
  const projectRow = (extended.error
    ? (await db.from("projects").select(baseCols).eq("id", projectId).maybeSingle()).data
    : extended.data) as Record<string, unknown> | null;
  if (!projectRow) return null;

  const [links, rules, staffRows] = await Promise.all([
    loadProjectServiceLinks(db, [projectId]),
    loadServiceBookingRules(db),
    db.from("project_staff").select("user_id").eq("project_id", projectId),
  ]);
  const projectLinks = links.get(projectId) ?? [];
  const serviceIds = projectLinks.map((l) => l.service_id);
  const serviceNames = projectLinks.length
    ? projectLinks.map((l) => l.service_name)
    : String(projectRow.service_type ?? "")
        .split(/\s*\+\s*|\s*,\s*/)
        .filter(Boolean);
  const serviceRules = serviceIds.map((id) => rules.get(id)).filter((r): r is ServiceBookingRule => Boolean(r));
  const duration = combinedDuration(
    serviceRules.map((r) => ({ durationMinutes: r.durationMinutes, bufferMinutes: r.bufferMinutes })),
    ctx.booking
  );

  let appointment: Appointment | null = null;
  if (ctx.schemaReady) {
    const { data } = await db
      .from("shoot_proposals")
      .select(APPOINTMENT_COLUMNS)
      .eq("project_id", projectId)
      .eq("appointment_key", "primary")
      .in("status", ["confirmed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) appointment = rowToAppointment(data as Record<string, unknown>, ctx.ownerId);
  } else {
    const { data } = await db
      .from("shoot_proposals")
      .select("id, project_id, proposed_at, status")
      .eq("project_id", projectId)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    if (data) appointment = rowToAppointment(data as Record<string, unknown>, ctx.ownerId);
  }

  const client = projectRow.clients as { name?: string; full_name?: string; email?: string; phone?: string } | null;
  return {
    projectId,
    projectName: (projectRow.project_name as string) || "Project",
    propertyAddress: (projectRow.property_address as string | null)?.trim() || null,
    projectStatus: String(projectRow.status ?? ""),
    schedulingStatus: (projectRow.scheduling_status as string | null) ?? null,
    clientId: (projectRow.client_id as string | null) ?? null,
    clientName: client?.full_name || client?.name || "Client",
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
    serviceIds,
    serviceNames,
    durationMinutes: duration.durationMinutes,
    bufferBefore: ctx.booking.bufferBeforeMinutes + duration.serviceBufferMinutes,
    bufferAfter: ctx.booking.bufferAfterMinutes,
    instantAllowedForServices: serviceRules.every((r) => r.instantBookingAllowed),
    servicesRequireQuote: serviceRules.some((r) => r.outsideRadiusRequiresQuote),
    travelMiles: projectRow.travel_distance_miles == null ? null : Number(projectRow.travel_distance_miles),
    outsideServiceArea: projectRow.outside_service_area === true,
    appointment,
    assignedStaffIds: (staffRows.data ?? []).map((r) => r.user_id as string),
  };
}

/** Derived scheduling status for projects created before v132 (column NULL). */
export function effectiveSchedulingStatus(facts: Pick<BookingProjectFacts, "schedulingStatus" | "appointment">): string {
  if (facts.appointment?.status === "confirmed") return "scheduled";
  if (facts.schedulingStatus) return facts.schedulingStatus;
  return "unscheduled";
}

// ── busy times ─────────────────────────────────────────────────────────────

type BusyLoad = { byCalendar: Map<string, BusyInterval[]>; failed: Set<string> };

async function loadGoogleBusy(ctx: BookingContext, calendarIds: string[], fromMs: number, toMs: number): Promise<BusyLoad> {
  const byCalendar = new Map<string, BusyInterval[]>();
  const failed = new Set<string>();
  if (!calendarIds.length) return { byCalendar, failed };
  const access = await getGoogleCalendarAccess(ctx.businessId);
  if (!access.ok) {
    if (access.error !== "not_connected") for (const id of calendarIds) failed.add(id);
    return { byCalendar, failed };
  }
  await Promise.all(
    calendarIds.map(async (calendarId) => {
      try {
        const result = await listGoogleEvents({
          accessToken: access.token,
          calendarId,
          calendarSummary: calendarId,
          timeZone: ctx.timeZone,
          timeMin: new Date(fromMs).toISOString(),
          timeMax: new Date(toMs).toISOString(),
          transport: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
        });
        if (result.degraded && !result.events.length) failed.add(calendarId);
        byCalendar.set(
          calendarId,
          result.events
            .filter((e) => !e.allDay && e.end)
            .map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end as string), label: "Busy" }))
            .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
        );
      } catch {
        failed.add(calendarId);
      }
    })
  );
  return { byCalendar, failed };
}

/**
 * Busy times from team members' own Google connections (v133), read with their own token.
 * A connection that needs reconnecting counts as unreadable (fail closed).
 */
async function loadMemberBusy(
  ctx: BookingContext,
  userIds: string[],
  fromMs: number,
  toMs: number
): Promise<Map<string, { intervals: BusyInterval[]; failed: boolean }>> {
  const out = new Map<string, { intervals: BusyInterval[]; failed: boolean }>();
  if (!userIds.length) return out;
  const connections = (await listMemberConnections(ctx.businessId)).filter((c) => userIds.includes(c.userId));
  await Promise.all(
    connections.map(async (c) => {
      if (c.status !== "active") {
        out.set(c.userId, { intervals: [], failed: true });
        return;
      }
      const access = await getMemberGoogleAccess(ctx.businessId, c.userId);
      if (!access.ok) {
        out.set(c.userId, { intervals: [], failed: true });
        return;
      }
      const intervals: BusyInterval[] = [];
      let failed = false;
      for (const calendarId of c.busyCalendarIds.length ? c.busyCalendarIds : ["primary"]) {
        try {
          const result = await listGoogleEvents({
            accessToken: access.token,
            calendarId,
            calendarSummary: calendarId,
            timeZone: ctx.timeZone,
            timeMin: new Date(fromMs).toISOString(),
            timeMax: new Date(toMs).toISOString(),
            transport: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
          });
          if (result.degraded && !result.events.length) failed = true;
          for (const e of result.events) {
            if (e.allDay || !e.end) continue;
            const start = Date.parse(e.start);
            const end = Date.parse(e.end as string);
            if (Number.isFinite(start) && Number.isFinite(end) && end > start) intervals.push({ start, end, label: "Busy" });
          }
        } catch {
          failed = true;
        }
      }
      out.set(c.userId, { intervals, failed });
    })
  );
  return out;
}

async function loadAppointmentsInRange(ctx: BookingContext, fromMs: number, toMs: number) {
  const { data } = await ctx.db
    .from("shoot_proposals")
    .select(`${APPOINTMENT_COLUMNS}, projects(property_address)`)
    .in("status", ["confirmed", "pending"])
    .gte("proposed_at", new Date(fromMs - DAY).toISOString())
    .lte("proposed_at", new Date(toMs + DAY).toISOString());
  return (data ?? []).map((row) => {
    const appointment = rowToAppointment(row as Record<string, unknown>, ctx.ownerId);
    const project = (row as { projects?: { property_address?: string | null } | null }).projects;
    return { appointment, address: project?.property_address?.trim() || null };
  });
}

async function loadActiveHolds(ctx: BookingContext, fromMs: number, toMs: number) {
  const { data, error } = await ctx.db
    .from("booking_holds")
    .select("id, project_id, assigned_user_id, block_start_at, block_end_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .lt("block_start_at", new Date(toMs + DAY).toISOString())
    .gt("block_end_at", new Date(fromMs - DAY).toISOString());
  if (error) return [];
  return data ?? [];
}

// ── availability ───────────────────────────────────────────────────────────

export type AvailabilityRequest = {
  facts: BookingProjectFacts;
  fromDay: string;
  toDay: string;
  /** Limit to these people (client chose a photographer, or admin picked one). */
  onlyUserIds?: string[];
  /** Rescheduling: ignore this appointment's own time. */
  excludeAppointmentId?: string | null;
  /** Admin view: include people who aren't marked bookable. */
  includeAllTeam?: boolean;
};

export type StaffAvailabilitySummary = {
  userId: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  shortBio: string;
  available: boolean;
  reason: string | null;
  slotCount: number;
};

export type AvailabilityResult = {
  timeZone: string;
  durationMinutes: number;
  serviceArea: ServiceAreaDecision;
  /** Why no instant booking is possible for this project (null = bookable). */
  blockedReason: "services_not_instant" | "outside_service_area" | "no_address" | "not_ready" | null;
  slots: { start: string; end: string; userId: string; cost: number; dayKey: string }[];
  daysWithSlots: string[];
  staff: StaffAvailabilitySummary[];
  recommendedUserId: string | null;
  travelKnown: boolean;
};

type Prepared = {
  engineInput: EngineInput;
  engineStaff: EngineStaff[];
  excluded: { member: ResolvedTeamMember; reason: string }[];
  travel: TravelTable;
};

async function prepare(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  fromMs: number,
  toMs: number,
  options: { onlyUserIds?: string[]; excludeAppointmentId?: string | null; includeAllTeam?: boolean; nowMs?: number }
): Promise<Prepared> {
  const roster = options.includeAllTeam ? ctx.team.map((m) => resolveMember(m, ctx.settings)) : ctx.bookable;
  const filtered = options.onlyUserIds?.length ? roster.filter((m) => options.onlyUserIds!.includes(m.userId)) : roster;

  const [appointments, holds] = await Promise.all([
    loadAppointmentsInRange(ctx, fromMs, toMs),
    ctx.schemaReady ? loadActiveHolds(ctx, fromMs, toMs) : Promise.resolve([]),
  ]);
  const calendarIds = [...new Set(filtered.flatMap((m) => m.blockCalendarIds))];
  const [busy, memberBusy] = await Promise.all([
    loadGoogleBusy(ctx, calendarIds, fromMs - DAY, toMs + DAY),
    loadMemberBusy(ctx, filtered.map((m) => m.userId), fromMs - DAY, toMs + DAY),
  ]);

  const travel = new TravelTable(ctx.db);
  const property = facts.propertyAddress;
  const otherAddresses = [...new Set(appointments.map((a) => a.address).filter((a): a is string => Boolean(a)))];
  const bases = [...new Set(filtered.map((m) => m.baseAddress).filter((a): a is string => Boolean(a)))];
  if (property) {
    await travel.prefetch([
      ...otherAddresses.flatMap((a): [string, string][] => [[a, property], [property, a]]),
      ...bases.flatMap((b): [string, string][] => [[b, property], [property, b]]),
    ]);
  }

  const excluded: Prepared["excluded"] = [];
  const engineStaff: EngineStaff[] = [];
  for (const member of filtered) {
    const fit = qualificationFit(member.profile.qualifiedServiceIds, facts.serviceIds);
    if (!fit.qualified) {
      excluded.push({ member, reason: "Not set up for these services" });
      continue;
    }
    if (member.serviceRadiusMiles != null && property && member.baseAddress && ctx.booking.outsideAreaBehavior !== "allow") {
      const miles = travel.miles(member.baseAddress, property);
      if (miles != null && miles > member.serviceRadiusMiles) {
        excluded.push({ member, reason: "Outside their service area" });
        continue;
      }
    }
    const mine = appointments.filter(
      (a) => a.appointment.assignedUserId === member.userId && a.appointment.id !== options.excludeAppointmentId
    );
    const holdBusy: BusyInterval[] = holds
      .filter((h) => h.assigned_user_id === member.userId && h.project_id !== facts.projectId)
      .map((h) => ({ start: Date.parse(h.block_start_at as string), end: Date.parse(h.block_end_at as string), label: "Held", kind: "hold" as const }));
    const own = memberBusy.get(member.userId);
    const googleBusy = [...member.blockCalendarIds.flatMap((id) => busy.byCalendar.get(id) ?? []), ...(own?.intervals ?? [])];
    engineStaff.push({
      userId: member.userId,
      name: member.name,
      workingHours: member.workingHours,
      maxShootsPerDay: member.maxShootsPerDay,
      baseAddress: member.baseAddress,
      appointments: mine.map(
        (a): EngineAppointment => ({
          id: a.appointment.id,
          projectId: a.appointment.projectId,
          start: a.appointment.start,
          end: a.appointment.end,
          bufferBefore: a.appointment.bufferBefore,
          bufferAfter: a.appointment.bufferAfter,
          address: a.address,
        })
      ),
      busy: [...googleBusy, ...holdBusy],
      weights: member.weights,
      fitScore: fit.score,
      // Fail closed: if someone's calendar can't be read, they aren't offered.
      calendarUnavailable: member.blockCalendarIds.some((id) => busy.failed.has(id)) || Boolean(own?.failed),
    });
  }

  return {
    engineInput: {
      timeZone: ctx.timeZone,
      nowMs: options.nowMs ?? Date.now(),
      rules: ctx.booking,
      durationMinutes: facts.durationMinutes,
      bufferBeforeMinutes: facts.bufferBefore,
      bufferAfterMinutes: facts.bufferAfter,
      propertyAddress: property,
      travelMinutes: travel.minutes,
      unknownTravelMinutes: UNKNOWN_TRAVEL_MINUTES,
    },
    engineStaff,
    excluded,
    travel,
  };
}

export async function computeAvailability(ctx: BookingContext, req: AvailabilityRequest): Promise<AvailabilityResult> {
  const { facts } = req;
  const serviceArea = decideServiceArea({
    oneWayMiles: facts.travelMiles,
    settings: ctx.booking,
    servicesRequireQuote: facts.servicesRequireQuote,
  });
  const empty = (blockedReason: AvailabilityResult["blockedReason"]): AvailabilityResult => ({
    timeZone: ctx.timeZone,
    durationMinutes: facts.durationMinutes,
    serviceArea,
    blockedReason,
    slots: [],
    daysWithSlots: [],
    staff: [],
    recommendedUserId: null,
    travelKnown: false,
  });
  if (!ctx.schemaReady) return empty("not_ready");
  if (!facts.propertyAddress) return empty("no_address");
  if (!facts.instantAllowedForServices) return empty("services_not_instant");
  if (!serviceArea.inside && serviceArea.behavior !== "allow") return empty("outside_service_area");

  const todayKey = zonedParts(Date.now(), ctx.timeZone).dayKey;
  const lastKey = addDaysToKey(todayKey, ctx.booking.bookingWindowDays);
  const fromDay = req.fromDay < todayKey ? todayKey : req.fromDay;
  let toDay = req.toDay > lastKey ? lastKey : req.toDay;
  if (dayKeysBetween(fromDay, toDay).length > MAX_RANGE_DAYS) toDay = addDaysToKey(fromDay, MAX_RANGE_DAYS - 1);
  const dayKeys = fromDay <= toDay ? dayKeysBetween(fromDay, toDay) : [];
  if (!dayKeys.length) return { ...empty(null) };

  const fromMs = Date.parse(`${fromDay}T00:00:00Z`) - DAY;
  const toMs = Date.parse(`${toDay}T23:59:59Z`) + DAY;
  const prepared = await prepare(ctx, facts, fromMs, toMs, req);
  const publicStaff = prepared.engineStaff.filter((s) => !s.calendarUnavailable);
  const perStaff = publicStaff.map((s) => slotsForStaff(prepared.engineInput, s, dayKeys));
  const merged = mergeSlotsAcrossStaff(perStaff);

  const summaries: StaffAvailabilitySummary[] = [];
  const memberById = new Map(ctx.team.map((m) => [m.userId, resolveMember(m, ctx.settings)]));
  prepared.engineStaff.forEach((s) => {
    const member = memberById.get(s.userId);
    const count = s.calendarUnavailable ? 0 : perStaff[publicStaff.indexOf(s)]?.length ?? 0;
    summaries.push({
      userId: s.userId,
      name: s.name,
      title: member?.title ?? "Photographer",
      avatarUrl: member?.avatarUrl ?? null,
      shortBio: member?.profile.shortBio ?? "",
      available: count > 0,
      reason: s.calendarUnavailable ? "Calendar unavailable" : count ? null : "No openings in these dates",
      slotCount: count,
    });
  });
  for (const ex of prepared.excluded) {
    summaries.push({
      userId: ex.member.userId,
      name: ex.member.name,
      title: ex.member.title,
      avatarUrl: ex.member.avatarUrl,
      shortBio: ex.member.profile.shortBio,
      available: false,
      reason: ex.reason,
      slotCount: 0,
    });
  }

  // Recommended person: whoever wins the most "any photographer" slots (best overall fit).
  const wins = new Map<string, number>();
  for (const slot of merged) wins.set(slot.userId, (wins.get(slot.userId) ?? 0) + 1);
  const recommendedUserId = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const byDay = new Map<string, EngineSlot[]>();
  for (const slot of merged) {
    const key = zonedParts(slot.start, ctx.timeZone).dayKey;
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }
  const slots = [...byDay.entries()].flatMap(([dayKey, list]) =>
    sortSlots(list, ctx.booking.slotSort).map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end).toISOString(),
      userId: s.userId,
      cost: Math.round(s.cost * 1000) / 1000,
      dayKey,
    }))
  );

  return {
    timeZone: ctx.timeZone,
    durationMinutes: facts.durationMinutes,
    serviceArea,
    blockedReason: null,
    slots,
    daysWithSlots: [...byDay.keys()].sort(),
    staff: summaries,
    recommendedUserId,
    travelKnown: facts.propertyAddress ? prepared.travel.minutes(prepared.engineStaff[0]?.baseAddress ?? null, facts.propertyAddress) != null : false,
  };
}

/**
 * Re-check one start time right before confirming (or for manual scheduling).
 * With `userId` null the best eligible person is chosen.
 */
export async function checkStart(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  startMs: number,
  options: { userId?: string | null; excludeAppointmentId?: string | null; includeAllTeam?: boolean; ignoreNotice?: boolean }
): Promise<{
  chosen: { userId: string; evaluation: SlotEvaluation } | null;
  ranked: { userId: string; name: string; ok: boolean; violations: string[]; cost: number; travelInMinutes: number; travelOutMinutes: number }[];
}> {
  const prepared = await prepare(ctx, facts, startMs - DAY, startMs + DAY, {
    onlyUserIds: options.userId ? [options.userId] : undefined,
    excludeAppointmentId: options.excludeAppointmentId,
    includeAllTeam: options.includeAllTeam,
    nowMs: options.ignoreNotice ? startMs - 365 * DAY : undefined,
  });
  const input = options.ignoreNotice
    ? { ...prepared.engineInput, rules: { ...prepared.engineInput.rules, bookingWindowDays: 3650 } }
    : prepared.engineInput;
  const ranked = rankStaffForStart(input, prepared.engineStaff, startMs);
  const best = ranked.find((r) => r.evaluation.ok) ?? null;
  return {
    chosen: best ? { userId: best.staff.userId, evaluation: best.evaluation } : null,
    ranked: ranked.map((r) => ({
      userId: r.staff.userId,
      name: r.staff.name,
      ok: r.evaluation.ok,
      violations: r.evaluation.violations,
      cost: r.cost,
      travelInMinutes: r.evaluation.travelInMinutes,
      travelOutMinutes: r.evaluation.travelOutMinutes,
    })),
  };
}

/** Evaluate one person at one time without choosing (reassignment preview). */
export async function evaluateFor(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  userId: string,
  startMs: number,
  excludeAppointmentId: string | null
): Promise<SlotEvaluation | null> {
  const prepared = await prepare(ctx, facts, startMs - DAY, startMs + DAY, {
    onlyUserIds: [userId],
    excludeAppointmentId,
    includeAllTeam: true,
    nowMs: startMs - 365 * DAY,
  });
  const staff = prepared.engineStaff[0];
  if (!staff) return null;
  return evaluateStart(
    { ...prepared.engineInput, rules: { ...prepared.engineInput.rules, bookingWindowDays: 3650 } },
    staff,
    startMs
  );
}

// ── holds ──────────────────────────────────────────────────────────────────

export async function createHold(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  userId: string,
  startMs: number
): Promise<{ id: string; expiresAt: string } | null> {
  const end = startMs + facts.durationMinutes * MINUTE;
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS).toISOString();
  // One hold per project at a time.
  await ctx.db.from("booking_holds").delete().eq("project_id", facts.projectId);
  const { data, error } = await ctx.db
    .from("booking_holds")
    .insert({
      project_id: facts.projectId,
      assigned_user_id: userId,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(end).toISOString(),
      block_start_at: new Date(startMs - facts.bufferBefore * MINUTE).toISOString(),
      block_end_at: new Date(end + facts.bufferAfter * MINUTE).toISOString(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string, expiresAt };
}

// ── travel snapshot at request time ────────────────────────────────────────

/**
 * Driving distance from the travel-pricing origin, the service-area decision, and the travel
 * fee line. Written once onto the project and the preliminary estimate; never recalculated.
 */
export async function travelSnapshotForRequest(input: {
  businessId: string;
  settings: AppSettings;
  propertyAddress: string | null;
  servicesRequireQuote: boolean;
  hidePricing: boolean;
}): Promise<{
  miles: number | null;
  minutes: number | null;
  serviceArea: ServiceAreaDecision;
  lineItem: { description: string; amount_cents: number } | null;
  note: string | null;
}> {
  const booking = input.settings.booking;
  const origin = businessAddress(input.settings);
  const db = await createTenantServiceClient(input.businessId);
  let miles: number | null = null;
  let minutes: number | null = null;
  if (origin && input.propertyAddress) {
    const table = new TravelTable(db);
    await table.prefetch([[origin, input.propertyAddress]]);
    miles = table.miles(origin, input.propertyAddress);
    minutes = table.minutes(origin, input.propertyAddress);
  }
  const serviceArea = decideServiceArea({ oneWayMiles: miles, settings: booking, servicesRequireQuote: input.servicesRequireQuote });

  if (booking.travel.model === "none") return { miles, minutes, serviceArea, lineItem: null, note: null };
  if (input.hidePricing) {
    return { miles, minutes, serviceArea, lineItem: null, note: "Travel fee was not added because this service hides pricing." };
  }
  if (!origin) {
    return { miles, minutes, serviceArea, lineItem: null, note: "Travel fee was not added: add your business address in Settings → Contact so travel can be measured." };
  }
  if (miles == null) {
    return {
      miles,
      minutes,
      serviceArea,
      lineItem: null,
      note: "Travel fee was not added because the driving distance could not be calculated (check the property address and the Google Maps API key).",
    };
  }
  if (!serviceArea.inside && serviceArea.requiresQuote) {
    return { miles, minutes, serviceArea, lineItem: null, note: `This property is ${Math.round(miles)} miles away, outside your ${serviceArea.radiusMiles}-mile service area. Send a custom quote.` };
  }
  const quote = priceTravel(miles, booking.travel);
  if (quote.outcome === "fee") {
    return { miles, minutes, serviceArea, lineItem: { description: quote.label, amount_cents: quote.feeCents }, note: null };
  }
  if (quote.outcome === "over_cap") {
    return { miles, minutes, serviceArea, lineItem: null, note: "Travel fee was not added because it is over your maximum travel fee. Quote travel manually." };
  }
  return { miles, minutes, serviceArea, lineItem: null, note: null };
}
