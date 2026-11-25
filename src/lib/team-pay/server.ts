/**
 * Team pay — server side (v140).
 *
 * An open pay period is always worked out live from the shoots (booked time, planned route,
 * services, estimate), so moving, reassigning or cancelling a shoot needs no bookkeeping here.
 * Approving a period stores the statement exactly as shown (team_pay_statements.snapshot);
 * from then on it is read back, never recomputed, and its shoots can't be edited.
 *
 * Reads degrade to `ready: false` before the migration; writes throw TeamPayNotReady.
 */
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";
import { loadTeam, resolveMember, type TeamMember } from "@/lib/booking/team";
import { TravelTable } from "@/lib/booking/routes";
import { zonedInstant, zonedParts } from "@/lib/booking/time";
import { loadProjectServiceLinks } from "@/lib/project-services";
import { getProjectActiveQuote } from "@/lib/quote-display";
import { isRoutesTravelLine } from "@/lib/booking/travel-pricing";
import { isTravelLineDescription } from "@/lib/travel-fee";
import type { ProjectQuote } from "@/lib/types";
import {
  adjustmentLine,
  buildStatement,
  computeShootLine,
  isLateCancel,
  lateCancelLine,
} from "./calc";
import { addDays, isDateKey, periodContaining, shiftPeriod } from "./periods";
import {
  DEFAULT_TEAM_PAY_SETTINGS,
  describePlan,
  type AdjustmentKind,
  type AdjustmentRow,
  type BaseType,
  type DriveFacts,
  type DriveType,
  type PayLine,
  type PayMember,
  type PayPeriod,
  type PayPlan,
  type PayStatement,
  type PeriodType,
  type ShootEdit,
  type ShootFacts,
  type StatementTotals,
  type TeamPayPerson,
  type TeamPaySettings,
  type WorkerType,
} from "./types";

export class TeamPayNotReady extends Error {
  constructor() {
    super("Team pay needs database migration v140 (team pay).");
  }
}

export class TeamPayError extends Error {}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

const PERIOD_TYPES: PeriodType[] = ["weekly", "biweekly", "semimonthly", "monthly"];
const BASE_TYPES: BaseType[] = ["hourly", "per_shoot", "per_service", "percent"];
const DRIVE_TYPES: DriveType[] = ["none", "hour", "mile", "both", "travel_fee"];
const ADJUSTMENT_KINDS: AdjustmentKind[] = ["bonus", "reimbursement", "deduction", "other"];

const int = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// ── Rows ↔ types ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function settingsFromRow(row: Row | null): TeamPaySettings {
  if (!row) return { ...DEFAULT_TEAM_PAY_SETTINGS };
  const d = DEFAULT_TEAM_PAY_SETTINGS;
  return {
    enabled: Boolean(row.enabled),
    periodType: PERIOD_TYPES.includes(row.period_type as PeriodType) ? (row.period_type as PeriodType) : d.periodType,
    periodAnchor: isDateKey(row.period_anchor) ? row.period_anchor : d.periodAnchor,
    lateCancelEnabled: Boolean(row.late_cancel_enabled),
    lateCancelHours: int(row.late_cancel_hours, 1, 168, d.lateCancelHours),
    lateCancelFeeCents: int(row.late_cancel_fee_cents, 0, 10_000_000, 0),
    allowTimeRequests: row.allow_time_requests !== false,
    allowCheckIn: Boolean(row.allow_check_in),
    reviewOverMinutes: int(row.review_over_minutes, 0, 600, d.reviewOverMinutes),
  };
}

function planFromRow(row: Row): PayPlan {
  const rates: Record<string, number> = {};
  if (row.service_rates && typeof row.service_rates === "object") {
    for (const [id, cents] of Object.entries(row.service_rates as Record<string, unknown>)) {
      const n = Math.round(Number(cents));
      if (Number.isFinite(n) && n > 0) rates[id] = n;
    }
  }
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    baseType: BASE_TYPES.includes(row.base_type as BaseType) ? (row.base_type as BaseType) : "hourly",
    baseRateCents: int(row.base_rate_cents, 0, 100_000_000, 0),
    percent: Math.min(100, Math.max(0, Number(row.percent) || 0)),
    serviceRates: rates,
    driveType: DRIVE_TYPES.includes(row.drive_type as DriveType) ? (row.drive_type as DriveType) : "none",
    driveHourCents: int(row.drive_hour_cents, 0, 100_000_000, 0),
    mileCents: Math.max(0, Number(row.mile_cents) || 0),
    payFirstDrive: row.pay_first_drive !== false,
    payDriveHome: row.pay_drive_home !== false,
    minPerShootCents: int(row.min_per_shoot_cents, 0, 100_000_000, 0),
    archived: Boolean(row.archived_at),
  };
}

function memberFromRow(row: Row): PayMember {
  return {
    userId: String(row.user_id),
    planId: row.plan_id ? String(row.plan_id) : null,
    workerType: row.worker_type === "employee" ? "employee" : "contractor",
    rateOverride: row.rate_override == null ? null : int(row.rate_override, 0, 100_000_000, 0),
  };
}

// ── Config ─────────────────────────────────────────────────────────────────

export type TeamPayConfig = {
  ready: boolean;
  settings: TeamPaySettings;
  plans: PayPlan[];
  members: PayMember[];
};

export async function loadTeamPayConfig(businessId: string): Promise<TeamPayConfig> {
  const db = await createTenantServiceClient(businessId);
  const [settings, plans, members] = await Promise.all([
    db.from("team_pay_settings").select("*").maybeSingle(),
    db.from("team_pay_plans").select("*").order("created_at", { ascending: true }),
    db.from("team_pay_members").select("*"),
  ]);
  if (isMissingTable(settings.error) || isMissingTable(plans.error) || isMissingTable(members.error)) {
    return { ready: false, settings: { ...DEFAULT_TEAM_PAY_SETTINGS }, plans: [], members: [] };
  }
  return {
    ready: true,
    settings: settingsFromRow((settings.data as Row | null) ?? null),
    plans: ((plans.data ?? []) as Row[]).map(planFromRow),
    members: ((members.data ?? []) as Row[]).map(memberFromRow),
  };
}

/**
 * Whether Team pay shows up at all, and for whom:
 * - `manage`: the owner's Team pay page (on, and at least one person besides the owner).
 * - `mine`: a team member's My pay page (on, and they're on a pay plan).
 */
export async function teamPayVisibility(
  businessId: string,
  userId: string
): Promise<{ manage: boolean; mine: boolean }> {
  try {
    // One small read for the common case (Team pay off): this runs on every admin page.
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db.from("team_pay_settings").select("enabled").maybeSingle();
    if (error || !(data as Row | null)?.enabled) return { manage: false, mine: false };
    const config = await loadTeamPayConfig(businessId);
    if (!config.ready || !config.settings.enabled) return { manage: false, mine: false };
    const activePlans = new Set(config.plans.filter((p) => !p.archived).map((p) => p.id));
    const mine = config.members.some((m) => m.userId === userId && m.planId && activePlans.has(m.planId));
    const team = await loadTeam(businessId);
    const manage = team.members.some((m) => m.role !== "owner");
    return { manage, mine };
  } catch {
    return { manage: false, mine: false };
  }
}

export async function saveTeamPaySettings(businessId: string, patch: Record<string, unknown>): Promise<TeamPaySettings> {
  const current = (await loadTeamPayConfig(businessId)).settings;
  const next: TeamPaySettings = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    periodType: PERIOD_TYPES.includes(patch.periodType as PeriodType) ? (patch.periodType as PeriodType) : current.periodType,
    periodAnchor: isDateKey(patch.periodAnchor) ? patch.periodAnchor : current.periodAnchor,
    lateCancelEnabled: typeof patch.lateCancelEnabled === "boolean" ? patch.lateCancelEnabled : current.lateCancelEnabled,
    lateCancelHours: "lateCancelHours" in patch ? int(patch.lateCancelHours, 1, 168, current.lateCancelHours) : current.lateCancelHours,
    lateCancelFeeCents:
      "lateCancelFeeCents" in patch ? int(patch.lateCancelFeeCents, 0, 10_000_000, current.lateCancelFeeCents) : current.lateCancelFeeCents,
    allowTimeRequests: typeof patch.allowTimeRequests === "boolean" ? patch.allowTimeRequests : current.allowTimeRequests,
    allowCheckIn: typeof patch.allowCheckIn === "boolean" ? patch.allowCheckIn : current.allowCheckIn,
    reviewOverMinutes:
      "reviewOverMinutes" in patch ? int(patch.reviewOverMinutes, 0, 600, current.reviewOverMinutes) : current.reviewOverMinutes,
  };
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("team_pay_settings").upsert(
    {
      enabled: next.enabled,
      period_type: next.periodType,
      period_anchor: next.periodAnchor,
      late_cancel_enabled: next.lateCancelEnabled,
      late_cancel_hours: next.lateCancelHours,
      late_cancel_fee_cents: next.lateCancelFeeCents,
      allow_time_requests: next.allowTimeRequests,
      allow_check_in: next.allowCheckIn,
      review_over_minutes: next.reviewOverMinutes,
    },
    { onConflict: "business_id" }
  );
  if (error) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't save the Team pay settings.");
  }
  return next;
}

export async function savePlan(businessId: string, input: Record<string, unknown>): Promise<PayPlan> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  if (!name) throw new TeamPayError("Give the pay plan a name.");
  if (!BASE_TYPES.includes(input.baseType as BaseType)) throw new TeamPayError("Choose how time at the shoot is paid.");
  if (!DRIVE_TYPES.includes(input.driveType as DriveType)) throw new TeamPayError("Choose how driving is paid.");
  const rates: Record<string, number> = {};
  if (input.serviceRates && typeof input.serviceRates === "object") {
    for (const [id, cents] of Object.entries(input.serviceRates as Record<string, unknown>).slice(0, 200)) {
      const n = Math.round(Number(cents));
      if (/^[0-9a-f-]{36}$/i.test(id) && Number.isFinite(n) && n > 0) rates[id] = Math.min(n, 100_000_000);
    }
  }
  const row = {
    name,
    base_type: input.baseType as BaseType,
    base_rate_cents: int(input.baseRateCents, 0, 100_000_000, 0),
    percent: Math.min(100, Math.max(0, Math.round((Number(input.percent) || 0) * 100) / 100)),
    service_rates: rates,
    drive_type: input.driveType as DriveType,
    drive_hour_cents: int(input.driveHourCents, 0, 100_000_000, 0),
    mile_cents: Math.min(100_000, Math.max(0, Math.round((Number(input.mileCents) || 0) * 100) / 100)),
    pay_first_drive: input.payFirstDrive !== false,
    pay_drive_home: input.payDriveHome !== false,
    min_per_shoot_cents: int(input.minPerShootCents, 0, 100_000_000, 0),
  };
  const db = await createTenantServiceClient(businessId);
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const query = id
    ? db.from("team_pay_plans").update(row).eq("id", id).select("*").single()
    : db.from("team_pay_plans").insert(row).select("*").single();
  const { data, error } = await query;
  if (error || !data) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't save the pay plan.");
  }
  return planFromRow(data as Row);
}

/** Removes a plan: people on it come off it. Approved statements keep their own copy. */
export async function deletePlan(businessId: string, planId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("team_pay_plans").delete().eq("id", planId);
  if (error) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't remove the pay plan.");
  }
}

export async function saveMember(businessId: string, input: Record<string, unknown>): Promise<PayMember> {
  const userId = typeof input.userId === "string" ? input.userId : "";
  if (!userId) throw new TeamPayError("Choose a team member.");
  const team = await loadTeam(businessId);
  if (!team.members.some((m) => m.userId === userId)) throw new TeamPayError("That person isn't on your team.");
  const planId = typeof input.planId === "string" && input.planId ? input.planId : null;
  const db = await createTenantServiceClient(businessId);
  if (planId) {
    const { data } = await db.from("team_pay_plans").select("id").eq("id", planId).maybeSingle();
    if (!data) throw new TeamPayError("That pay plan no longer exists.");
  }
  const row = {
    user_id: userId,
    plan_id: planId,
    worker_type: (input.workerType === "employee" ? "employee" : "contractor") as WorkerType,
    rate_override: input.rateOverride == null || input.rateOverride === "" ? null : int(input.rateOverride, 0, 100_000_000, 0),
  };
  const { data, error } = await db.from("team_pay_members").upsert(row, { onConflict: "business_id,user_id" }).select("*").single();
  if (error || !data) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't save this person's pay.");
  }
  return memberFromRow(data as Row);
}

// ── Period overview ────────────────────────────────────────────────────────

export type PersonStatement = { person: TeamPayPerson; planSummary: string; statement: PayStatement };

export type PeriodOverview = {
  ready: boolean;
  settings: TeamPaySettings;
  timeZone: string;
  todayKey: string;
  period: PayPeriod;
  previous: PayPeriod;
  next: PayPeriod;
  isCurrent: boolean;
  people: PersonStatement[];
  totals: StatementTotals;
};

type Snapshot = {
  lines: PayLine[];
  totals: StatementTotals;
  overtimeWeeks: { weekStart: string; minutes: number }[];
  person: { name: string; email: string; workerType: WorkerType; planName: string; planSummary: string };
};

type ShootRow = {
  id: string;
  project_id: string;
  proposed_at: string;
  end_at: string | null;
  status: string;
  assigned_user_id: string | null;
  cancelled_at: string | null;
  projects: {
    project_name?: string | null;
    property_address?: string | null;
    service_id?: string | null;
    service_type?: string | null;
    deleted_at?: string | null;
  } | null;
};

function sumTotals(list: StatementTotals[]): StatementTotals {
  const total: StatementTotals = {
    amountCents: 0,
    shoots: 0,
    onsiteMinutes: 0,
    driveMinutes: 0,
    miles: 0,
    adjustmentsCents: 0,
    upcomingShoots: 0,
    upcomingCents: 0,
  };
  for (const t of list) {
    total.amountCents += t.amountCents;
    total.shoots += t.shoots;
    total.onsiteMinutes += t.onsiteMinutes;
    total.driveMinutes += t.driveMinutes;
    total.miles += t.miles;
    total.adjustmentsCents += t.adjustmentsCents;
    total.upcomingShoots += t.upcomingShoots;
    total.upcomingCents += t.upcomingCents;
  }
  total.miles = Math.round(total.miles * 10) / 10;
  return total;
}

/** Planned driving for each shoot: home → first, between shoots, last → home (per person, per day). */
async function planDrives(
  db: TenantServiceClient,
  shoots: { id: string; userId: string; dateKey: string; start: number; address: string | null }[],
  baseOf: (userId: string) => string | null
): Promise<Map<string, DriveFacts>> {
  const out = new Map<string, DriveFacts>();
  const groups = new Map<string, typeof shoots>();
  for (const shoot of shoots) {
    const key = `${shoot.userId}|${shoot.dateKey}`;
    groups.set(key, [...(groups.get(key) ?? []), shoot]);
  }
  type Leg = { id: string; from: string; to: string; kind: "home" | "previous" | "out" };
  const legs: Leg[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.start - b.start);
    const base = baseOf(list[0].userId);
    list.forEach((shoot, i) => {
      if (!shoot.address) return;
      const from = i === 0 ? base : list[i - 1].address;
      if (from) legs.push({ id: shoot.id, from, to: shoot.address, kind: i === 0 ? "home" : "previous" });
    });
    const last = list[list.length - 1];
    if (base && last.address) legs.push({ id: last.id, from: last.address, to: base, kind: "out" });
  }
  if (!legs.length) return out;
  const table = new TravelTable(db);
  // prefetch takes a bounded batch at a time.
  for (let i = 0; i < legs.length; i += 300) {
    await table.prefetch(legs.slice(i, i + 300).map((l) => [l.from, l.to]));
  }
  for (const leg of legs) {
    const minutes = table.minutes(leg.from, leg.to);
    const miles = table.miles(leg.from, leg.to);
    if (minutes == null || miles == null) continue;
    const current = out.get(leg.id);
    if (leg.kind === "out") {
      // Only meaningful once the drive in is known too.
      if (current) out.set(leg.id, { ...current, outMinutes: minutes, outMiles: miles });
    } else {
      out.set(leg.id, { inMinutes: minutes, inMiles: miles, from: leg.kind, outMinutes: 0, outMiles: 0 });
    }
  }
  return out;
}

function editFromRow(row: Row): ShootEdit {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    onsiteMinutes: num(row.onsite_minutes),
    driveMinutes: num(row.drive_minutes),
    miles: num(row.miles),
    amountCents: num(row.amount_cents),
    note: typeof row.note === "string" && row.note ? row.note : null,
    arrivedAt: (row.arrived_at as string | null) ?? null,
    doneAt: (row.done_at as string | null) ?? null,
  };
}

function personOf(member: TeamMember, pay: PayMember | undefined, plan: PayPlan | null): TeamPayPerson {
  return {
    userId: member.userId,
    name: member.name || member.email,
    email: member.email,
    avatarUrl: member.avatarUrl,
    role: member.role,
    workerType: pay?.workerType ?? "contractor",
    plan,
    rateOverride: pay?.rateOverride ?? null,
  };
}

async function businessZone(businessId: string) {
  const settings = await getAppSettings(businessId);
  return { appSettings: settings, timeZone: resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone };
}

/**
 * Everyone's statement for one pay period. `onlyUserId` limits it to one person (My pay).
 * `start` is any date in the wanted period; omitted = the period today falls in.
 */
export async function buildPeriodOverview(
  businessId: string,
  opts: { start?: string | null; onlyUserId?: string | null; now?: Date } = {}
): Promise<PeriodOverview> {
  const now = opts.now ?? new Date();
  const [config, zone, team] = await Promise.all([loadTeamPayConfig(businessId), businessZone(businessId), loadTeam(businessId)]);
  const { timeZone, appSettings } = zone;
  const { settings } = config;
  const todayKey = zonedParts(now.getTime(), timeZone).dayKey;
  const period = periodContaining(isDateKey(opts.start) ? opts.start : todayKey, settings.periodType, settings.periodAnchor);
  const current = periodContaining(todayKey, settings.periodType, settings.periodAnchor);
  const empty: PeriodOverview = {
    ready: config.ready,
    settings,
    timeZone,
    todayKey,
    period,
    previous: shiftPeriod(period, settings.periodType, settings.periodAnchor, -1),
    next: shiftPeriod(period, settings.periodType, settings.periodAnchor, 1),
    isCurrent: period.start === current.start,
    people: [],
    totals: sumTotals([]),
  };
  if (!config.ready) return empty;

  const db = await createTenantServiceClient(businessId);
  const plansById = new Map(config.plans.map((p) => [p.id, p]));
  const payByUser = new Map(config.members.map((m) => [m.userId, m]));
  const ownerId = team.members.find((m) => m.role === "owner")?.userId ?? null;

  // Stored (approved / paid) statements for this period come back as they were approved.
  let storedQuery = db.from("team_pay_statements").select("*").eq("period_start", period.start);
  if (opts.onlyUserId) storedQuery = storedQuery.eq("user_id", opts.onlyUserId);
  const stored = await storedQuery;
  if (isMissingTable(stored.error)) return { ...empty, ready: false };
  const storedByUser = new Map(((stored.data ?? []) as Row[]).map((r) => [String(r.user_id), r]));

  const people: PersonStatement[] = [];
  const live: { member: TeamMember; pay: PayMember; plan: PayPlan }[] = [];
  for (const member of team.members) {
    if (opts.onlyUserId && member.userId !== opts.onlyUserId) continue;
    const pay = payByUser.get(member.userId);
    const plan = pay?.planId ? plansById.get(pay.planId) ?? null : null;
    const row = storedByUser.get(member.userId);
    if (row) {
      const snap = (row.snapshot ?? {}) as Partial<Snapshot>;
      people.push({
        person: { ...personOf(member, pay, plan), workerType: snap.person?.workerType ?? pay?.workerType ?? "contractor" },
        planSummary: snap.person?.planSummary ?? "",
        statement: {
          userId: member.userId,
          period: { start: String(row.period_start), end: String(row.period_end) },
          status: row.status === "paid" ? "paid" : "approved",
          lines: snap.lines ?? [],
          totals: snap.totals ?? sumTotals([]),
          reviewCount: 0,
          overtimeWeeks: snap.overtimeWeeks ?? [],
          approvedAt: (row.approved_at as string | null) ?? null,
          paid: row.paid_at
            ? { at: String(row.paid_at), method: (row.paid_method as string | null) ?? null, reference: (row.paid_reference as string | null) ?? null }
            : null,
        },
      });
      storedByUser.delete(member.userId);
    } else if (pay && plan && !plan.archived) {
      live.push({ member, pay, plan });
    }
  }
  // Statements for people who have since left the team.
  for (const [userId, row] of storedByUser) {
    const snap = (row.snapshot ?? {}) as Partial<Snapshot>;
    people.push({
      person: {
        userId,
        name: snap.person?.name ?? "Former team member",
        email: snap.person?.email ?? "",
        avatarUrl: null,
        role: "staff",
        workerType: snap.person?.workerType ?? "contractor",
        plan: null,
        rateOverride: null,
      },
      planSummary: snap.person?.planSummary ?? "",
      statement: {
        userId,
        period: { start: String(row.period_start), end: String(row.period_end) },
        status: row.status === "paid" ? "paid" : "approved",
        lines: snap.lines ?? [],
        totals: snap.totals ?? sumTotals([]),
        reviewCount: 0,
        overtimeWeeks: snap.overtimeWeeks ?? [],
        approvedAt: (row.approved_at as string | null) ?? null,
        paid: row.paid_at
          ? { at: String(row.paid_at), method: (row.paid_method as string | null) ?? null, reference: (row.paid_reference as string | null) ?? null }
          : null,
      },
    });
  }

  if (live.length) {
    const liveIds = new Set(live.map((l) => l.member.userId));
    const fromIso = new Date(zonedInstant(period.start, 0, timeZone)).toISOString();
    const toIso = new Date(zonedInstant(addDays(period.end, 1), 0, timeZone)).toISOString();
    const statuses = settings.lateCancelEnabled && settings.lateCancelFeeCents > 0 ? ["confirmed", "cancelled"] : ["confirmed"];
    const shootsRes = await db
      .from("shoot_proposals")
      .select(
        "id, project_id, proposed_at, end_at, status, assigned_user_id, cancelled_at, projects(project_name, property_address, service_id, service_type, deleted_at)"
      )
      .in("status", statuses)
      .gte("proposed_at", fromIso)
      .lt("proposed_at", toIso)
      .order("proposed_at", { ascending: true })
      .limit(2000);
    const rows = ((shootsRes.data ?? []) as unknown as ShootRow[])
      .map((r) => ({ ...r, userId: r.assigned_user_id ?? ownerId }))
      .filter((r): r is ShootRow & { userId: string } => Boolean(r.userId && liveIds.has(r.userId) && r.projects && !r.projects.deleted_at));
    const confirmed = rows.filter((r) => r.status === "confirmed");
    const cancelled = rows.filter((r) => r.status === "cancelled");
    const proposalIds = confirmed.map((r) => r.id);
    const projectIds = [...new Set(confirmed.map((r) => r.project_id))];

    const needsPrice = live.some((l) => l.plan.baseType === "percent" || l.plan.driveType === "travel_fee");
    const driveUsers = new Set(
      live.filter((l) => l.plan.driveType === "hour" || l.plan.driveType === "mile" || l.plan.driveType === "both").map((l) => l.member.userId)
    );
    const bases = new Map(team.members.map((m) => [m.userId, resolveMember(m, appSettings).baseAddress]));
    const dateOf = (iso: string) => zonedParts(Date.parse(iso), timeZone).dayKey;

    const [links, quotesRes, editsRes, requestsRes, adjustmentsRes, drives] = await Promise.all([
      loadProjectServiceLinks(db, projectIds),
      needsPrice && projectIds.length
        ? db.from("project_quotes").select("*").in("project_id", projectIds)
        : Promise.resolve({ data: [] as unknown[] }),
      proposalIds.length ? db.from("team_pay_shoot_edits").select("*").in("proposal_id", proposalIds) : Promise.resolve({ data: [] as unknown[] }),
      proposalIds.length
        ? db.from("team_pay_requests").select("*").eq("status", "pending").in("proposal_id", proposalIds)
        : Promise.resolve({ data: [] as unknown[] }),
      db
        .from("team_pay_adjustments")
        .select("*")
        .gte("pay_date", period.start)
        .lte("pay_date", period.end)
        .in("user_id", [...liveIds]),
      planDrives(
        db,
        confirmed
          .filter((r) => driveUsers.has(r.userId))
          .map((r) => ({
            id: r.id,
            userId: r.userId,
            dateKey: dateOf(r.proposed_at),
            start: Date.parse(r.proposed_at),
            address: (r.projects?.property_address ?? "").trim() || null,
          })),
        (userId) => bases.get(userId) ?? null
      ).catch(() => new Map<string, DriveFacts>()),
    ]);

    const quotesByProject = new Map<string, ProjectQuote[]>();
    for (const q of (quotesRes.data ?? []) as ProjectQuote[]) {
      quotesByProject.set(q.project_id, [...(quotesByProject.get(q.project_id) ?? []), q]);
    }
    const priceOf = (projectId: string): { priceCents: number | null; travelFeeCents: number } => {
      const active = getProjectActiveQuote(quotesByProject.get(projectId) ?? [], "admin");
      if (!active) return { priceCents: null, travelFeeCents: 0 };
      const items = Array.isArray(active.quote.line_items) ? active.quote.line_items : [];
      const travel = items
        .filter((i) => isRoutesTravelLine(i.description ?? "") || isTravelLineDescription(i.description ?? ""))
        .reduce((sum, i) => sum + (Number(i.amount_cents) || 0), 0);
      return { priceCents: Math.max(0, (Number(active.quote.total_cents) || 0) - travel), travelFeeCents: Math.max(0, travel) };
    };
    const edits = new Map(((editsRes.data ?? []) as Row[]).map((r) => [String(r.proposal_id), editFromRow(r)]));
    const requests = new Map(
      ((requestsRes.data ?? []) as Row[]).map((r) => [
        String(r.proposal_id),
        { id: String(r.id), onsiteMinutes: Number(r.onsite_minutes) || 0, note: (r.note as string | null) || null },
      ])
    );
    // A project's travel fee is paid once, on its first shoot of the period.
    const travelPaid = new Set<string>();

    const linesByUser = new Map<string, PayLine[]>();
    const push = (userId: string, line: PayLine) => linesByUser.set(userId, [...(linesByUser.get(userId) ?? []), line]);
    const liveByUser = new Map(live.map((l) => [l.member.userId, l]));

    for (const r of confirmed) {
      const who = liveByUser.get(r.userId)!;
      const start = Date.parse(r.proposed_at);
      const end = r.end_at ? Date.parse(r.end_at) : start + 3_600_000;
      const linked = links.get(r.project_id) ?? [];
      const services = linked.length
        ? linked.map((l) => ({ id: l.service_id, name: l.service_name }))
        : [{ id: r.projects?.service_id ?? null, name: (r.projects?.service_type ?? "").trim() || "Shoot" }];
      const price = needsPrice ? priceOf(r.project_id) : { priceCents: null, travelFeeCents: 0 };
      const travelFeeCents = travelPaid.has(r.project_id) ? 0 : price.travelFeeCents;
      travelPaid.add(r.project_id);
      const facts: ShootFacts = {
        proposalId: r.id,
        projectId: r.project_id,
        userId: r.userId,
        startIso: new Date(start).toISOString(),
        dateKey: dateOf(r.proposed_at),
        plannedMinutes: Math.max(0, Math.round((end - start) / 60_000)),
        title: (r.projects?.project_name ?? "").trim() || "Shoot",
        address: (r.projects?.property_address ?? "").trim() || null,
        services,
        priceCents: price.priceCents,
        travelFeeCents,
        drive: drives.get(r.id) ?? null,
        edit: edits.get(r.id) ?? null,
        pendingRequest: requests.get(r.id) ?? null,
        upcoming: end > now.getTime(),
      };
      push(r.userId, computeShootLine(facts, who.plan, who.pay, settings));
    }
    for (const r of cancelled) {
      if (!isLateCancel(r.proposed_at, r.cancelled_at, settings.lateCancelHours)) continue;
      const hours = (Date.parse(r.proposed_at) - Date.parse(r.cancelled_at as string)) / 3_600_000;
      push(
        r.userId,
        lateCancelLine(
          {
            proposalId: r.id,
            projectId: r.project_id,
            dateKey: dateOf(r.proposed_at),
            startIso: new Date(r.proposed_at).toISOString(),
            title: (r.projects?.project_name ?? "").trim() || "Shoot",
            address: (r.projects?.property_address ?? "").trim() || null,
          },
          settings.lateCancelFeeCents,
          Math.max(0, hours)
        )
      );
    }
    for (const a of (adjustmentsRes.data ?? []) as Row[]) {
      const row: AdjustmentRow = {
        id: String(a.id),
        userId: String(a.user_id),
        dateKey: String(a.pay_date),
        kind: ADJUSTMENT_KINDS.includes(a.kind as AdjustmentKind) ? (a.kind as AdjustmentKind) : "other",
        label: String(a.label ?? ""),
        amountCents: Number(a.amount_cents) || 0,
      };
      push(row.userId, adjustmentLine(row));
    }

    for (const who of live) {
      people.push({
        person: personOf(who.member, who.pay, who.plan),
        planSummary: describePlan(who.plan, who.pay.rateOverride),
        statement: buildStatement({
          userId: who.member.userId,
          period,
          lines: linesByUser.get(who.member.userId) ?? [],
          workerType: who.pay.workerType,
          todayKey,
        }),
      });
    }
  }

  people.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return { ...empty, people, totals: sumTotals(people.map((p) => p.statement.totals)) };
}

// ── Locking ────────────────────────────────────────────────────────────────

/** True when that person's pay for that date is already approved or paid. */
async function isLocked(db: TenantServiceClient, userId: string, dateKey: string): Promise<boolean> {
  const { data } = await db
    .from("team_pay_statements")
    .select("id")
    .eq("user_id", userId)
    .lte("period_start", dateKey)
    .gte("period_end", dateKey)
    .limit(1);
  return Boolean(data?.length);
}

const LOCKED_MESSAGE = "This pay period is already approved. Reopen it to make changes.";

async function shootFor(businessId: string, proposalId: string) {
  const db = await createTenantServiceClient(businessId);
  const [{ data }, zone, team] = await Promise.all([
    db.from("shoot_proposals").select("id, proposed_at, end_at, status, assigned_user_id").eq("id", proposalId).maybeSingle(),
    businessZone(businessId),
    loadTeam(businessId),
  ]);
  if (!data) throw new TeamPayError("That shoot no longer exists.");
  const row = data as { id: string; proposed_at: string; end_at: string | null; status: string; assigned_user_id: string | null };
  const ownerId = team.members.find((m) => m.role === "owner")?.userId ?? null;
  const userId = row.assigned_user_id ?? ownerId;
  if (!userId) throw new TeamPayError("That shoot has nobody assigned.");
  return { db, row, userId, dateKey: zonedParts(Date.parse(row.proposed_at), zone.timeZone).dayKey, timeZone: zone.timeZone };
}

// ── Owner actions ──────────────────────────────────────────────────────────

/** Correct one shoot's time, drive, miles or amount. A null field goes back to the planned value. */
export async function saveShootEdit(
  businessId: string,
  actorId: string,
  proposalId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { db, userId, dateKey } = await shootFor(businessId, proposalId);
  if (await isLocked(db, userId, dateKey)) throw new TeamPayError(LOCKED_MESSAGE);
  const optional = (key: string, max: number) => {
    if (!(key in patch)) return undefined;
    const v = patch[key];
    if (v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new TeamPayError("Check the numbers you entered.");
    return n;
  };
  const row: Record<string, unknown> = { proposal_id: proposalId, updated_by: actorId };
  const onsite = optional("onsiteMinutes", 1440);
  const drive = optional("driveMinutes", 1440);
  const miles = optional("miles", 5000);
  const amount = optional("amountCents", 100_000_000);
  if (onsite !== undefined) row.onsite_minutes = onsite === null ? null : Math.round(onsite);
  if (drive !== undefined) row.drive_minutes = drive === null ? null : Math.round(drive);
  if (miles !== undefined) row.miles = miles === null ? null : Math.round(miles * 10) / 10;
  if (amount !== undefined) row.amount_cents = amount === null ? null : Math.round(amount);
  if ("note" in patch) row.note = typeof patch.note === "string" && patch.note.trim() ? patch.note.trim().slice(0, 500) : null;
  const { error } = await db.from("team_pay_shoot_edits").upsert(row, { onConflict: "business_id,proposal_id" });
  if (error) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't save the change.");
  }
}

export async function addAdjustment(businessId: string, actorId: string, input: Record<string, unknown>): Promise<void> {
  const userId = typeof input.userId === "string" ? input.userId : "";
  const dateKey = isDateKey(input.dateKey) ? input.dateKey : "";
  const kind = ADJUSTMENT_KINDS.includes(input.kind as AdjustmentKind) ? (input.kind as AdjustmentKind) : "bonus";
  const amount = Math.round(Math.abs(Number(input.amountCents)));
  if (!userId || !dateKey) throw new TeamPayError("Choose who it's for and the date.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) throw new TeamPayError("Enter an amount.");
  const db = await createTenantServiceClient(businessId);
  if (await isLocked(db, userId, dateKey)) throw new TeamPayError(LOCKED_MESSAGE);
  const { error } = await db.from("team_pay_adjustments").insert({
    user_id: userId,
    pay_date: dateKey,
    kind,
    label: typeof input.label === "string" ? input.label.trim().slice(0, 200) : "",
    amount_cents: kind === "deduction" ? -amount : amount,
    created_by: actorId,
  });
  if (error) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't add it.");
  }
}

export async function deleteAdjustment(businessId: string, adjustmentId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("team_pay_adjustments").select("user_id, pay_date").eq("id", adjustmentId).maybeSingle();
  if (!data) return;
  if (await isLocked(db, String((data as Row).user_id), String((data as Row).pay_date))) throw new TeamPayError(LOCKED_MESSAGE);
  const { error } = await db.from("team_pay_adjustments").delete().eq("id", adjustmentId);
  if (error) throw new TeamPayError("Couldn't remove it.");
}

/** Approve one person's period: stores the statement as shown and locks it. */
export async function approveStatement(
  businessId: string,
  actorId: string,
  userId: string,
  periodStart: string
): Promise<PersonStatement> {
  const overview = await buildPeriodOverview(businessId, { start: periodStart, onlyUserId: userId });
  if (!overview.ready) throw new TeamPayNotReady();
  const entry = overview.people.find((p) => p.person.userId === userId);
  if (!entry) throw new TeamPayError("This person isn't on a pay plan.");
  const { statement, person } = entry;
  if (statement.status === "approved" || statement.status === "paid") return entry;
  if (statement.reviewCount > 0) throw new TeamPayError("Review the flagged shoots first.");
  if (statement.totals.upcomingShoots > 0) {
    throw new TeamPayError(
      `${statement.totals.upcomingShoots} shoot${statement.totals.upcomingShoots === 1 ? " hasn't" : "s haven't"} happened yet in this period.`
    );
  }
  const snapshot: Snapshot = {
    lines: statement.lines,
    totals: statement.totals,
    overtimeWeeks: statement.overtimeWeeks,
    person: {
      name: person.name,
      email: person.email,
      workerType: person.workerType,
      planName: person.plan?.name ?? "",
      planSummary: entry.planSummary,
    },
  };
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("team_pay_statements").insert({
    user_id: userId,
    period_start: overview.period.start,
    period_end: overview.period.end,
    status: "approved",
    total_cents: statement.totals.amountCents,
    snapshot,
    approved_by: actorId,
  });
  if (error) {
    if (isMissingTable(error)) throw new TeamPayNotReady();
    throw new TeamPayError("Couldn't approve this statement.");
  }
  return { ...entry, statement: { ...statement, status: "approved", approvedAt: new Date().toISOString() } };
}

/** Undo an approval (not once it's paid): the period goes back to live numbers. */
export async function reopenStatement(businessId: string, userId: string, periodStart: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("team_pay_statements").select("id, status").eq("user_id", userId).eq("period_start", periodStart).maybeSingle();
  if (!data) return;
  if ((data as Row).status === "paid") throw new TeamPayError("This statement is marked paid. Undo the payment first.");
  const { error } = await db.from("team_pay_statements").delete().eq("id", String((data as Row).id));
  if (error) throw new TeamPayError("Couldn't reopen this statement.");
}

export async function markStatementPaid(
  businessId: string,
  userId: string,
  periodStart: string,
  input: { method?: unknown; reference?: unknown; paid?: boolean }
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const paid = input.paid !== false;
  const { data, error } = await db
    .from("team_pay_statements")
    .update(
      paid
        ? {
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_method: typeof input.method === "string" ? input.method.trim().slice(0, 60) || null : null,
            paid_reference: typeof input.reference === "string" ? input.reference.trim().slice(0, 120) || null : null,
          }
        : { status: "approved", paid_at: null, paid_method: null, paid_reference: null }
    )
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .select("id");
  if (error) throw new TeamPayError("Couldn't update this statement.");
  if (!data?.length) throw new TeamPayError("Approve this statement first.");
}

// ── Team member actions ────────────────────────────────────────────────────

/** A team member asks for the time they were really on site. One open request per shoot. */
export async function createTimeRequest(
  businessId: string,
  userId: string,
  input: { proposalId?: unknown; onsiteMinutes?: unknown; note?: unknown }
): Promise<void> {
  const config = await loadTeamPayConfig(businessId);
  if (!config.ready) throw new TeamPayNotReady();
  if (!config.settings.allowTimeRequests) throw new TeamPayError("Time change requests are turned off.");
  const proposalId = typeof input.proposalId === "string" ? input.proposalId : "";
  const minutes = Math.round(Number(input.onsiteMinutes));
  if (!proposalId || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440) throw new TeamPayError("Enter the time you were on site.");
  const shoot = await shootFor(businessId, proposalId);
  if (shoot.userId !== userId) throw new TeamPayError("That shoot isn't yours.");
  if (Date.parse(shoot.row.proposed_at) > Date.now()) throw new TeamPayError("That shoot hasn't happened yet.");
  if (await isLocked(shoot.db, userId, shoot.dateKey)) throw new TeamPayError("That pay period is already approved.");
  await shoot.db.from("team_pay_requests").delete().eq("proposal_id", proposalId).eq("user_id", userId).eq("status", "pending");
  const { error } = await shoot.db.from("team_pay_requests").insert({
    user_id: userId,
    proposal_id: proposalId,
    onsite_minutes: minutes,
    note: typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 500) : null,
  });
  if (error) throw new TeamPayError("Couldn't send the request.");
}

/** Approve (the requested time becomes the shoot's time) or decline a request. */
export async function decideTimeRequest(
  businessId: string,
  actorId: string,
  requestId: string,
  approve: boolean
): Promise<{ userId: string; proposalId: string; onsiteMinutes: number } | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("team_pay_requests").select("*").eq("id", requestId).maybeSingle();
  const row = data as Row | null;
  if (!row || row.status !== "pending") return null;
  if (approve) await saveShootEdit(businessId, actorId, String(row.proposal_id), { onsiteMinutes: Number(row.onsite_minutes) });
  await db
    .from("team_pay_requests")
    .update({ status: approve ? "approved" : "declined", decided_by: actorId, decided_at: new Date().toISOString() })
    .eq("id", requestId);
  return { userId: String(row.user_id), proposalId: String(row.proposal_id), onsiteMinutes: Number(row.onsite_minutes) || 0 };
}

/** Settle a long check-in: pay the booked time (`useActual` false) or the checked-in time. */
export async function settleCheckIn(
  businessId: string,
  actorId: string,
  proposalId: string,
  minutes: number
): Promise<void> {
  await saveShootEdit(businessId, actorId, proposalId, { onsiteMinutes: minutes });
}

/** "I've arrived" / "Done" from a team member's phone, on the day of the shoot. */
export async function checkIn(
  businessId: string,
  userId: string,
  input: { proposalId?: unknown; step?: unknown }
): Promise<void> {
  const config = await loadTeamPayConfig(businessId);
  if (!config.ready) throw new TeamPayNotReady();
  if (!config.settings.allowCheckIn) throw new TeamPayError("Check-in is turned off.");
  const proposalId = typeof input.proposalId === "string" ? input.proposalId : "";
  const shoot = await shootFor(businessId, proposalId);
  if (shoot.userId !== userId) throw new TeamPayError("That shoot isn't yours.");
  if (shoot.row.status !== "confirmed") throw new TeamPayError("That shoot isn't confirmed.");
  const today = zonedParts(Date.now(), shoot.timeZone).dayKey;
  if (shoot.dateKey !== today) throw new TeamPayError("You can check in on the day of the shoot.");
  const now = new Date().toISOString();
  const { data: existing } = await shoot.db.from("team_pay_shoot_edits").select("arrived_at").eq("proposal_id", proposalId).maybeSingle();
  const arrived = (existing as Row | null)?.arrived_at as string | null | undefined;
  if (input.step === "done" && !arrived) throw new TeamPayError("Tap Arrived first.");
  const row: Record<string, unknown> =
    input.step === "done"
      ? { proposal_id: proposalId, done_at: now }
      : { proposal_id: proposalId, arrived_at: now, done_at: null };
  const { error } = await shoot.db.from("team_pay_shoot_edits").upsert(row, { onConflict: "business_id,proposal_id" });
  if (error) throw new TeamPayError("Couldn't save your check-in.");
}

/** A team member's approved and paid statements, newest first (My pay history). */
export async function listStatementHistory(
  businessId: string,
  userId: string
): Promise<{ periodStart: string; periodEnd: string; status: "approved" | "paid"; totalCents: number; paidAt: string | null }[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("team_pay_statements")
    .select("period_start, period_end, status, total_cents, paid_at")
    .eq("user_id", userId)
    .order("period_start", { ascending: false })
    .limit(60);
  if (error) return [];
  return ((data ?? []) as Row[]).map((r) => ({
    periodStart: String(r.period_start),
    periodEnd: String(r.period_end),
    status: r.status === "paid" ? "paid" : "approved",
    totalCents: Number(r.total_cents) || 0,
    paidAt: (r.paid_at as string | null) ?? null,
  }));
}

/** Active services, for the per-service rates in the pay plan builder. */
export async function listPayServices(businessId: string): Promise<{ id: string; name: string }[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("business_services")
    .select("id, name, is_active, display_order")
    .order("display_order", { ascending: true });
  if (error) return [];
  return ((data ?? []) as Row[]).filter((r) => r.is_active !== false).map((r) => ({ id: String(r.id), name: String(r.name ?? "Service") }));
}
