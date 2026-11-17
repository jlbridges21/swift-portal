/**
 * Staff account Settings (server). A team member's own profile, availability, notification
 * choices and preferences. Booking-profile fields (title, bio, phone, home base, hours, limits,
 * time off) live in team_scheduling_profiles — the same row the owner edits in
 * Settings → Instant Booking → Team — so there is one copy of each.
 */

import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import type { AppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";
import { isMissingColumn } from "@/lib/booking/team";
import { mergeWeeklyHours, type WeeklyHours } from "@/lib/booking/settings";
import { zonedParts } from "@/lib/booking/time";
import {
  STAFF_PERMISSION_GROUP_LABELS,
  STAFF_PERMISSION_META,
  hasStaffPermission,
  type StaffPermissionGroupId,
} from "@/lib/staff-permissions";
import {
  parseStaffEventPrefs,
  parseThemePreference,
  parseTimeOff,
  upcomingTimeOff,
  isValidTimeZone,
  type StaffNotificationEventPrefs,
  type ThemePreference,
  type TimeOffEntry,
} from "@/lib/staff-account-shared";
import type { Profile } from "@/lib/types";

export type StaffAccessGroup = { id: StaffPermissionGroupId; label: string; allowed: string[] };

export type StaffAccountData = {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  businessName: string;
  /** v134 applied (time off, per-event notifications, time zone, theme). */
  v134Ready: boolean;
  /** v132 applied (booking profile table). */
  bookingReady: boolean;
  profile: {
    displayTitle: string;
    shortBio: string;
    phone: string;
    baseAddress: string;
  };
  availability: {
    bookable: boolean;
    /** Null = follows the business hours. */
    workingHours: WeeklyHours | null;
    businessHours: WeeklyHours;
    maxShootsPerDay: number | null;
    businessMaxShootsPerDay: number;
    serviceRadiusMiles: number | null;
    businessServiceRadiusMiles: number | null;
    serviceRadiusEnabled: boolean;
    canEditLimits: boolean;
    timeOff: TimeOffEntry[];
    timeZone: string;
    /** Today in the studio time zone (YYYY-MM-DD). */
    todayKey: string;
  };
  notifications: {
    emailOn: boolean;
    inAppOn: boolean;
    events: StaffNotificationEventPrefs;
  };
  preferences: {
    timeZone: string | null;
    businessTimeZone: string;
    theme: ThemePreference;
  };
  access: {
    groups: StaffAccessGroup[];
  };
};

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

async function readOwnRow(businessId: string, userId: string) {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.from("team_scheduling_profiles").select("*").eq("user_id", userId).maybeSingle();
  return { row: (data as Record<string, unknown> | null) ?? null, ready: !error || !isMissingTable(error) };
}

export function businessTimeZoneOf(settings: AppSettings): string {
  return resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
}

export function staffAccessGroups(profile: Pick<Profile, "staff_permissions">): StaffAccessGroup[] {
  const groups = new Map<StaffPermissionGroupId, string[]>();
  for (const meta of STAFF_PERMISSION_META) {
    if (!hasStaffPermission(profile.staff_permissions, meta.key)) continue;
    const list = groups.get(meta.group) ?? [];
    list.push(meta.label);
    groups.set(meta.group, list);
  }
  return (Object.keys(STAFF_PERMISSION_GROUP_LABELS) as StaffPermissionGroupId[]).map((id) => ({
    id,
    label: STAFF_PERMISSION_GROUP_LABELS[id],
    allowed: groups.get(id) ?? [],
  }));
}

export async function loadStaffAccount(args: {
  profile: Profile;
  businessId: string;
  businessName: string;
  settings: AppSettings;
}): Promise<StaffAccountData> {
  const { profile, businessId, settings } = args;
  const record = profile as Profile & Record<string, unknown>;
  const v134Profiles = "notification_event_prefs" in record;
  const { row, ready: bookingReady } = await readOwnRow(businessId, profile.id);
  const booking = settings.booking;
  const businessZone = businessTimeZoneOf(settings);
  const todayKey = zonedParts(Date.now(), businessZone).dayKey;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name ?? "",
    avatarUrl: profile.avatar_url ?? null,
    businessName: args.businessName,
    v134Ready: v134Profiles && (!row || "time_off" in row),
    bookingReady,
    profile: {
      displayTitle: str(row?.display_title),
      shortBio: str(row?.short_bio),
      phone: str(row?.phone),
      baseAddress: str(row?.base_address),
    },
    availability: {
      // Staff are bookable only once the owner says so (no row = not set up yet).
      bookable: row?.bookable === true,
      workingHours: Array.isArray(row?.working_hours) ? mergeWeeklyHours(row?.working_hours) : null,
      businessHours: booking.workingHours,
      maxShootsPerDay: num(row?.max_shoots_per_day),
      businessMaxShootsPerDay: booking.maxShootsPerDay,
      serviceRadiusMiles: num(row?.service_radius_miles),
      businessServiceRadiusMiles: booking.serviceRadiusEnabled ? booking.serviceRadiusMiles : null,
      serviceRadiusEnabled: booking.serviceRadiusEnabled,
      canEditLimits: row ? row.staff_can_edit_limits !== false : true,
      timeOff: upcomingTimeOff(parseTimeOff(row?.time_off), todayKey),
      timeZone: businessZone,
      todayKey,
    },
    notifications: {
      emailOn: profile.email_notifications_enabled !== false,
      inAppOn: profile.in_app_notifications_enabled !== false,
      events: parseStaffEventPrefs(record.notification_event_prefs),
    },
    preferences: {
      timeZone: isValidTimeZone(record.time_zone) ? (record.time_zone as string) : null,
      businessTimeZone: businessZone,
      theme: parseThemePreference(record.theme_preference),
    },
    access: { groups: staffAccessGroups(profile) },
  };
}

// ── saves ──────────────────────────────────────────────────────────────────

type SaveResult = { ok: true } | { ok: false; status: number; error: string };

const MIGRATION_V134 = "This needs a quick database update (v134) before it can be saved. Ask your studio owner.";

/**
 * Save the fields a team member may change on their own booking profile. Owner-only fields
 * (bookable, services, calendars, assignment weights) are never touched. A first save creates
 * the row as not bookable, so filling in a bio never puts someone on the booking page.
 */
export async function saveOwnBookingProfile(
  businessId: string,
  userId: string,
  patch: {
    displayTitle?: string;
    shortBio?: string;
    phone?: string;
    baseAddress?: string;
    workingHours?: WeeklyHours | null;
    maxShootsPerDay?: number | null;
    serviceRadiusMiles?: number | null;
    timeOff?: TimeOffEntry[];
  }
): Promise<SaveResult> {
  const { row, ready } = await readOwnRow(businessId, userId);
  if (!ready) return { ok: false, status: 409, error: "Booking profiles aren't set up for this studio yet. Ask your studio owner." };

  const touchesAvailability =
    patch.workingHours !== undefined ||
    patch.maxShootsPerDay !== undefined ||
    patch.serviceRadiusMiles !== undefined ||
    patch.timeOff !== undefined;
  if (touchesAvailability && row?.bookable !== true) {
    return { ok: false, status: 403, error: "Your studio owner hasn't made you bookable yet." };
  }
  const touchesLimits = patch.maxShootsPerDay !== undefined || patch.serviceRadiusMiles !== undefined;
  if (touchesLimits && row?.staff_can_edit_limits === false) {
    return { ok: false, status: 403, error: "Your studio owner manages your shoot limits." };
  }

  const update: Record<string, unknown> = {};
  if (patch.displayTitle !== undefined) update.display_title = patch.displayTitle.trim().slice(0, 80) || null;
  if (patch.shortBio !== undefined) update.short_bio = patch.shortBio.trim().slice(0, 400) || null;
  if (patch.phone !== undefined) update.phone = patch.phone.trim().slice(0, 40) || null;
  if (patch.baseAddress !== undefined) update.base_address = patch.baseAddress.trim().slice(0, 300) || null;
  if (patch.workingHours !== undefined) update.working_hours = patch.workingHours;
  if (patch.maxShootsPerDay !== undefined) update.max_shoots_per_day = patch.maxShootsPerDay;
  if (patch.serviceRadiusMiles !== undefined) update.service_radius_miles = patch.serviceRadiusMiles;
  if (patch.timeOff !== undefined) update.time_off = patch.timeOff;
  if (!Object.keys(update).length) return { ok: true };

  const db = await createTenantServiceClient(businessId);
  const { error } = row
    ? await db.from("team_scheduling_profiles").update(update).eq("user_id", userId)
    : await db.from("team_scheduling_profiles").insert({ user_id: userId, bookable: false, ...update });
  if (error) {
    if (isMissingColumn(error)) return { ok: false, status: 409, error: MIGRATION_V134 };
    return { ok: false, status: 500, error: "Couldn't save. Please try again." };
  }
  return { ok: true };
}

export async function saveOwnPreferences(
  businessId: string,
  userId: string,
  patch: {
    fullName?: string;
    emailOn?: boolean;
    inAppOn?: boolean;
    events?: StaffNotificationEventPrefs;
    timeZone?: string | null;
    theme?: ThemePreference;
  }
): Promise<SaveResult> {
  const db = await createTenantServiceClient(businessId);
  const base: Record<string, unknown> = {};
  const v134: Record<string, unknown> = {};
  if (patch.fullName !== undefined) base.full_name = patch.fullName.trim().slice(0, 120) || null;
  if (patch.emailOn !== undefined) base.email_notifications_enabled = patch.emailOn;
  if (patch.inAppOn !== undefined) base.in_app_notifications_enabled = patch.inAppOn;
  if (patch.events !== undefined) v134.notification_event_prefs = patch.events;
  if (patch.timeZone !== undefined) v134.time_zone = patch.timeZone;
  if (patch.theme !== undefined) v134.theme_preference = patch.theme;

  const all = { ...base, ...v134 };
  if (!Object.keys(all).length) return { ok: true };
  const { error } = await db.raw.from("profiles").update(all).eq("id", userId).eq("business_id", businessId);
  if (error) {
    if (isMissingColumn(error)) {
      if (Object.keys(base).length) {
        const retry = await db.raw.from("profiles").update(base).eq("id", userId).eq("business_id", businessId);
        if (retry.error) return { ok: false, status: 500, error: "Couldn't save. Please try again." };
      }
      return { ok: false, status: 409, error: MIGRATION_V134 };
    }
    return { ok: false, status: 500, error: "Couldn't save. Please try again." };
  }
  return { ok: true };
}
