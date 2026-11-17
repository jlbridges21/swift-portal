/**
 * Team scheduling profiles (server). Solo-first: with no profile rows the business owner is
 * the one bookable person and uses the business working hours, address and limits — zero setup.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getBusinessOwnerUserId } from "@/lib/staff";
import type { AppSettings } from "@/lib/app-settings";
import {
  mergeAssignmentWeights,
  mergeWeeklyHours,
  type AssignmentWeights,
  type BookingSettings,
  type WeeklyHours,
} from "@/lib/booking/settings";

export type TeamProfileFields = {
  displayTitle: string;
  shortBio: string;
  phone: string;
  baseAddress: string;
  /** Null = business working hours. */
  workingHours: WeeklyHours | null;
  /** Null = business default. */
  maxShootsPerDay: number | null;
  /** Null = business service radius. */
  serviceRadiusMiles: number | null;
  bookable: boolean;
  qualifiedServiceIds: string[];
  blockCalendarIds: string[];
  destinationCalendarId: string;
  /** Null = business defaults. */
  assignmentWeights: AssignmentWeights | null;
};

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "staff";
  hasProfile: boolean;
  profile: TeamProfileFields;
};

/** Effective values after business defaults are applied. */
export type ResolvedTeamMember = TeamMember & {
  workingHours: WeeklyHours;
  maxShootsPerDay: number;
  baseAddress: string | null;
  serviceRadiusMiles: number | null;
  blockCalendarIds: string[];
  weights: AssignmentWeights;
  title: string;
};

export function businessAddress(settings: AppSettings): string | null {
  const b = settings.business;
  const parts = [b.addressLine1, b.addressLine2, b.city, [b.state, b.postalCode].filter(Boolean).join(" "), b.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  if (!b.addressLine1?.trim() && !b.city?.trim()) return null;
  return parts.join(", ");
}

function emptyProfile(role: TeamMember["role"]): TeamProfileFields {
  return {
    displayTitle: "",
    shortBio: "",
    phone: "",
    baseAddress: "",
    workingHours: null,
    maxShootsPerDay: null,
    serviceRadiusMiles: null,
    // The owner is bookable until they say otherwise; staff only once their profile is set up.
    bookable: role === "owner",
    qualifiedServiceIds: [],
    blockCalendarIds: [],
    destinationCalendarId: "",
    assignmentWeights: null,
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function rowToProfile(row: Record<string, unknown>, role: TeamMember["role"]): TeamProfileFields {
  const base = emptyProfile(role);
  const weights = row.assignment_weights;
  return {
    displayTitle: typeof row.display_title === "string" ? row.display_title : "",
    shortBio: typeof row.short_bio === "string" ? row.short_bio : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    baseAddress: typeof row.base_address === "string" ? row.base_address : "",
    workingHours: Array.isArray(row.working_hours) ? mergeWeeklyHours(row.working_hours) : null,
    maxShootsPerDay: typeof row.max_shoots_per_day === "number" ? row.max_shoots_per_day : null,
    serviceRadiusMiles: typeof row.service_radius_miles === "number" ? row.service_radius_miles : null,
    bookable: typeof row.bookable === "boolean" ? row.bookable : base.bookable,
    qualifiedServiceIds: Array.isArray(row.qualified_service_ids) ? (row.qualified_service_ids as string[]) : [],
    blockCalendarIds: Array.isArray(row.block_calendar_ids) ? (row.block_calendar_ids as string[]) : [],
    destinationCalendarId: typeof row.destination_calendar_id === "string" ? row.destination_calendar_id : "",
    assignmentWeights:
      weights && typeof weights === "object" && Object.keys(weights as object).length
        ? mergeAssignmentWeights(weights, { distance: 80, workload: 50, fit: 80 })
        : null,
  };
}

/** Everyone on the team (owner, admins, active staff) with their scheduling profile. */
export async function loadTeam(businessId: string): Promise<{ members: TeamMember[]; profilesReady: boolean }> {
  const raw = await createServiceClient();
  const [ownerId, { data: people }] = await Promise.all([
    getBusinessOwnerUserId(businessId),
    raw
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, disabled_at")
      .eq("business_id", businessId)
      .in("role", ["admin", "staff"])
      .is("disabled_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const rows = [...(people ?? [])];
  if (ownerId && !rows.some((p) => p.id === ownerId)) {
    const { data: owner } = await raw
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, disabled_at")
      .eq("id", ownerId)
      .maybeSingle();
    if (owner) rows.unshift(owner);
  }

  const db = await createTenantServiceClient(businessId);
  const { data: profileRows, error } = await db.from("team_scheduling_profiles").select("*");
  const profilesReady = !error || !isMissingTable(error);
  const byUser = new Map<string, Record<string, unknown>>();
  for (const row of profileRows ?? []) byUser.set(String(row.user_id), row as Record<string, unknown>);

  const members: TeamMember[] = rows.map((p) => {
    const role: TeamMember["role"] = p.id === ownerId ? "owner" : p.role === "admin" ? "admin" : "staff";
    const stored = byUser.get(p.id as string);
    return {
      userId: p.id as string,
      name: ((p.full_name as string | null) || (p.email as string) || "Team member").trim(),
      email: (p.email as string) || "",
      avatarUrl: (p.avatar_url as string | null) ?? null,
      role,
      hasProfile: Boolean(stored),
      profile: stored ? rowToProfile(stored, role) : emptyProfile(role),
    };
  });
  members.sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  return { members, profilesReady };
}

export function resolveMember(member: TeamMember, settings: AppSettings): ResolvedTeamMember {
  const booking: BookingSettings = settings.booking;
  const p = member.profile;
  const ownerBlocks = member.role === "owner" ? booking.blockCalendarIds : [];
  return {
    ...member,
    workingHours: p.workingHours ?? booking.workingHours,
    maxShootsPerDay: p.maxShootsPerDay ?? booking.maxShootsPerDay,
    baseAddress: p.baseAddress.trim() || businessAddress(settings),
    serviceRadiusMiles: booking.serviceRadiusEnabled ? (p.serviceRadiusMiles ?? booking.serviceRadiusMiles) : null,
    blockCalendarIds: [...new Set([...ownerBlocks, ...p.blockCalendarIds])],
    weights: p.assignmentWeights ?? booking.assignmentWeights,
    title: p.displayTitle.trim() || (member.role === "staff" ? "Photographer" : "Photographer"),
  };
}

/**
 * People clients can be booked with. Solo businesses (nobody marked bookable) fall back to
 * the owner so instant booking works with zero team setup.
 */
export function bookableMembers(members: TeamMember[], settings: AppSettings): ResolvedTeamMember[] {
  const bookable = members.filter((m) => m.profile.bookable);
  const list = bookable.length ? bookable : members.filter((m) => m.role === "owner").slice(0, 1);
  return list.map((m) => resolveMember(m, settings));
}

export function isTeamBusiness(members: TeamMember[]): boolean {
  return members.filter((m) => m.profile.bookable).length > 1;
}

export async function saveTeamProfile(
  businessId: string,
  userId: string,
  fields: TeamProfileFields
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("team_scheduling_profiles").upsert(
    {
      user_id: userId,
      display_title: fields.displayTitle.trim().slice(0, 80) || null,
      short_bio: fields.shortBio.trim().slice(0, 400) || null,
      phone: fields.phone.trim().slice(0, 40) || null,
      base_address: fields.baseAddress.trim().slice(0, 300) || null,
      working_hours: fields.workingHours,
      max_shoots_per_day: fields.maxShootsPerDay,
      service_radius_miles: fields.serviceRadiusMiles,
      bookable: fields.bookable,
      qualified_service_ids: fields.qualifiedServiceIds,
      block_calendar_ids: fields.blockCalendarIds,
      destination_calendar_id: fields.destinationCalendarId || null,
      assignment_weights: fields.assignmentWeights ?? {},
    },
    { onConflict: "business_id,user_id" }
  );
  if (error) {
    if (isMissingTable(error)) {
      return { ok: false, status: 409, error: "Apply database migration v132 (Instant Booking) to save team scheduling profiles." };
    }
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true };
}

/** Validate a profile PATCH from the browser. */
export function parseTeamProfile(raw: unknown): { ok: true; fields: TeamProfileFields } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid profile." };
  const r = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const intOrNull = (v: unknown, min: number, max: number) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const ids = (v: unknown, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 300))].slice(0, max) : [];
  const uuidList = ids(r.qualifiedServiceIds, 100).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (typeof r.shortBio === "string" && r.shortBio.length > 400) return { ok: false, error: "Keep the bio under 400 characters." };
  return {
    ok: true,
    fields: {
      displayTitle: s(r.displayTitle, 80),
      shortBio: s(r.shortBio, 400),
      phone: s(r.phone, 40),
      baseAddress: s(r.baseAddress, 300),
      workingHours: Array.isArray(r.workingHours) ? mergeWeeklyHours(r.workingHours) : null,
      maxShootsPerDay: intOrNull(r.maxShootsPerDay, 1, 50),
      serviceRadiusMiles: intOrNull(r.serviceRadiusMiles, 1, 1000),
      bookable: r.bookable === true,
      qualifiedServiceIds: uuidList,
      blockCalendarIds: ids(r.blockCalendarIds, 20),
      destinationCalendarId: s(r.destinationCalendarId, 300),
      assignmentWeights:
        r.assignmentWeights && typeof r.assignmentWeights === "object"
          ? mergeAssignmentWeights(r.assignmentWeights, { distance: 80, workload: 50, fit: 80 })
          : null,
    },
  };
}
