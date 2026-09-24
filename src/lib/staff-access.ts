/**
 * Staff access helpers — Phase 3 enforcement.
 *
 * ONE permission checker: staffCan(). Route every check through it.
 * Missing / unknown / never-delegable → DENIED for staff.
 * Owner admins (admin | super_admin) pass operational checks; never-delegable
 * surfaces still use assertAdminOnly().
 */

import { cache } from "react";
import { NextResponse } from "next/server";
import type { Profile } from "@/lib/types";
import {
  NEVER_DELEGABLE_PERMISSION_KEYS,
  hasStaffPermission,
  type StaffPermissionKey,
} from "@/lib/staff-permissions";

export type StaffArea = "projects" | "clients" | "media" | "calendar" | "messages";

export const STAFF_AREA_PERMISSION: Record<StaffArea, StaffPermissionKey> = {
  projects: "area.projects",
  clients: "area.clients",
  media: "area.media",
  calendar: "area.calendar",
  messages: "area.messages",
};

export const STAFF_AREA_HOME: Record<StaffArea, string> = {
  projects: "/admin/projects",
  clients: "/admin/clients",
  media: "/admin/media",
  calendar: "/admin/calendar",
  messages: "/admin/messages",
};

const AREA_ORDER: StaffArea[] = [
  "projects",
  "clients",
  "media",
  "calendar",
  "messages",
];

export function isOwnerAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin" || profile?.role === "super_admin";
}

export function isActiveStaff(profile: Profile | null | undefined): boolean {
  return Boolean(profile && profile.role === "staff" && !profile.disabled_at);
}

/** Business operator: owner admin or active staff (may still lack permissions). */
export function isBusinessOperator(profile: Profile | null | undefined): boolean {
  return isOwnerAdmin(profile) || isActiveStaff(profile);
}

/**
 * THE permission checker. Admins pass. Staff need an explicit true flag.
 * Never-delegable keys always false for staff (and are not in StaffPermissionKey).
 */
export function staffCan(
  profile: Profile | null | undefined,
  key: StaffPermissionKey
): boolean {
  if (!profile) return false;
  if (isOwnerAdmin(profile)) return true;
  if (!isActiveStaff(profile)) return false;
  return hasStaffPermission(profile.staff_permissions, key);
}

/** Staff has at least one area.* permission. */
export function staffHasAnyArea(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (isOwnerAdmin(profile)) return true;
  if (!isActiveStaff(profile)) return false;
  return AREA_ORDER.some((area) => staffCan(profile, STAFF_AREA_PERMISSION[area]));
}

export function staffCanAccessArea(
  profile: Profile | null | undefined,
  area: StaffArea
): boolean {
  return staffCan(profile, STAFF_AREA_PERMISSION[area]);
}

/** First reachable area path, or /staff explanatory home. */
export function staffHomePath(profile: Profile | null | undefined): string {
  if (!profile || !isActiveStaff(profile)) return "/staff";
  for (const area of AREA_ORDER) {
    if (staffCan(profile, STAFF_AREA_PERMISSION[area])) {
      return STAFF_AREA_HOME[area];
    }
  }
  return "/staff";
}

export function staffVisibleNavAreas(profile: Profile | null | undefined): StaffArea[] {
  if (!profile) return [];
  if (isOwnerAdmin(profile)) return [...AREA_ORDER];
  if (!isActiveStaff(profile)) return [];
  return AREA_ORDER.filter((a) => staffCan(profile, STAFF_AREA_PERMISSION[a]));
}

/** Map pathname → staff area for middleware / layout. */
export function adminPathArea(pathname: string): StaffArea | "adminOnly" | "shell" {
  if (
    pathname.startsWith("/admin/settings") ||
    pathname.startsWith("/admin/leads") ||
    pathname === "/billing" ||
    pathname.startsWith("/billing/") ||
    pathname.startsWith("/onboarding")
  ) {
    return "adminOnly";
  }
  if (pathname.startsWith("/admin/projects") || pathname.startsWith("/admin/projects/")) {
    return "projects";
  }
  if (pathname.startsWith("/admin/clients")) return "clients";
  if (pathname.startsWith("/admin/media")) return "media";
  if (pathname.startsWith("/admin/calendar")) return "calendar";
  if (pathname.startsWith("/admin/messages")) return "messages";
  if (pathname === "/admin" || pathname === "/admin/") return "shell";
  // Unknown /admin/* — deny staff by default
  return "adminOnly";
}

export function staffMayAccessAdminPath(
  profile: Profile,
  pathname: string
): boolean {
  if (isOwnerAdmin(profile)) return true;
  if (!isActiveStaff(profile)) return false;
  const area = adminPathArea(pathname);
  if (area === "adminOnly") return false;
  if (area === "shell") return staffHasAnyArea(profile);
  return passesAccessGate(profile, { area });
}

export type AccessGate =
  | { adminOnly: true }
  | { permission: StaffPermissionKey | StaffPermissionKey[]; requireAll?: boolean }
  | { area: StaffArea }
  | { anyArea: true };

export function passesAccessGate(
  profile: Profile | null | undefined,
  gate: AccessGate
): boolean {
  if (!profile) return false;
  if (isOwnerAdmin(profile)) return true;
  if (!isActiveStaff(profile)) return false;

  if ("adminOnly" in gate && gate.adminOnly) return false;

  if ("anyArea" in gate) return staffHasAnyArea(profile);

  if ("area" in gate) return staffCanAccessArea(profile, gate.area);

  if ("permission" in gate) {
    const keys = Array.isArray(gate.permission) ? gate.permission : [gate.permission];
    if (keys.length === 0) return false;
    return gate.requireAll
      ? keys.every((k) => staffCan(profile, k))
      : keys.some((k) => staffCan(profile, k));
  }

  return false;
}

export function forbiddenResponse(message = "Forbidden."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFoundResponse(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Resolve which project IDs a staff member may see.
 * - Owner admin → "all"
 * - Staff with projects.view_all → "all"
 * - Otherwise → assigned project_staff ids (may be empty)
 */
export async function resolveVisibleProjectIds(
  businessId: string,
  profile: Profile
): Promise<"all" | string[]> {
  if (isOwnerAdmin(profile)) return "all";
  if (!isActiveStaff(profile)) return [];
  if (staffCan(profile, "projects.view_all")) return "all";

  // Dynamic import keeps this module Edge-safe for middleware (no Node supabase/server).
  const { createServiceClient } = await import("@/lib/supabase/server");
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("project_staff")
    .select("project_id")
    .eq("business_id", businessId)
    .eq("user_id", profile.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.project_id as string);
}

/** Request-scoped memo of visible project ids. */
export const getVisibleProjectIds = cache(
  async (businessId: string, profileId: string, role: string, permsJson: string) => {
    // Rebuild a minimal profile for the check — callers pass serialized perms for cache key stability
    const profile = {
      id: profileId,
      role,
      staff_permissions: JSON.parse(permsJson || "{}"),
      disabled_at: null,
    } as Profile;
    return resolveVisibleProjectIds(businessId, profile);
  }
);

export async function visibleProjectIdsFor(
  businessId: string,
  profile: Profile
): Promise<"all" | string[]> {
  return getVisibleProjectIds(
    businessId,
    profile.id,
    profile.role,
    JSON.stringify(profile.staff_permissions ?? {})
  );
}

/**
 * Staff may access this project? Admins always. Else assignment or view_all.
 * Returns false → caller should 404 (do not confirm existence).
 */
export async function canAccessProject(
  businessId: string,
  profile: Profile,
  projectId: string
): Promise<boolean> {
  if (isOwnerAdmin(profile)) return true;
  if (!isActiveStaff(profile)) return false;
  if (!staffCan(profile, "area.projects") && !staffCan(profile, "projects.view_all")) {
    // Area gate: without area.projects, even view_all shouldn't open projects area —
    // but view_all implies projects access when set; require area.projects OR view_all
  }
  if (!staffCan(profile, "area.projects")) return false;

  const visible = await visibleProjectIdsFor(businessId, profile);
  if (visible === "all") return true;
  return visible.includes(projectId);
}

/** Apply project scope to a supabase query builder with .in("id", ...) or no-op for all. */
export function applyProjectIdFilter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  column: string,
  visible: "all" | string[]
): T | null {
  if (visible === "all") return query;
  if (visible.length === 0) return null; // caller should return empty
  return query.in(column, visible);
}

/** Never-delegable action refusal message. */
export function neverDelegableMessage(key: string): string {
  return `${key} cannot be delegated to staff. Owner only.`;
}

export function assertNeverDelegableBlocked(
  profile: Profile,
  key: (typeof NEVER_DELEGABLE_PERMISSION_KEYS)[number]
): NextResponse | null {
  if (isOwnerAdmin(profile)) return null;
  return forbiddenResponse(neverDelegableMessage(key));
}

/** Payment / money notification types that require money.view. */
export const MONEY_NOTIFICATION_TYPES = new Set([
  "payment_received",
  "payment_failed",
  "payment_confirmed",
  "invoice_available",
  "invoice_paid",
  "awaiting_payment",
  "quote_sent",
  "preliminary_estimate_created",
]);

/** Never-delegable system emails — staff must never receive these. */
export const NEVER_DELEGABLE_NOTIFICATION_TYPES = new Set([
  "billing",
  "subscription",
  "subscription_past_due",
  "subscription_canceled",
  "trial_ending",
  "trial_ended",
  "payment_method_required",
  "plan_changed",
]);

export function staffShouldReceiveNotification(
  profile: { role: string; staff_permissions?: unknown; disabled_at?: string | null },
  notificationType: string
): boolean {
  if (profile.role === "admin" || profile.role === "super_admin") return true;
  if (profile.role !== "staff" || profile.disabled_at) return false;
  if (NEVER_DELEGABLE_NOTIFICATION_TYPES.has(notificationType)) return false;
  if (MONEY_NOTIFICATION_TYPES.has(notificationType)) {
    return hasStaffPermission(profile.staff_permissions, "money.view");
  }
  // Non-money: staff on the project will be filtered by caller; allow if they have any area
  const fake = profile as Profile;
  return staffHasAnyArea(fake);
}
