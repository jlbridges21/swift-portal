/**
 * Who may act on a project's booking, resolved once per request:
 *  - client via booking-link token (bound to business + client + project, host must match)
 *  - signed-in client with access to the project
 *  - business owner/admin, or staff with scheduling permission
 */
import { getProfile } from "@/lib/auth";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getTenantContext } from "@/lib/tenant";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { openBookingToken } from "@/lib/booking/token";
import type { BookingActor } from "@/lib/booking/actions";

export type BookingAccess = {
  businessId: string;
  projectId: string;
  actor: BookingActor;
  role: "client" | "business";
  /** Business: may confirm/override/reassign (owner, admin, staff with scheduling.confirm). */
  canManage: boolean;
  canOverride: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveBookingAccess(input: {
  token?: unknown;
  projectId?: unknown;
}): Promise<BookingAccess | null> {
  const token = typeof input.token === "string" ? input.token : null;
  if (token) {
    const payload = openBookingToken(token);
    if (!payload) return null;
    const host = await getPublicHostContext();
    if (host.kind === "tenant" && host.businessId && host.businessId !== payload.b) return null;
    const db = await createTenantServiceClient(payload.b);
    const { data: project } = await db.from("projects").select("id, client_id").eq("id", payload.p).maybeSingle();
    if (!project || project.client_id !== payload.c) return null;
    const { data: client } = await db.from("clients").select("id, user_id, deleted_at").eq("id", payload.c).maybeSingle();
    if (!client || client.deleted_at) return null;
    return {
      businessId: payload.b,
      projectId: payload.p,
      actor: { kind: "client", userId: (client.user_id as string | null) ?? null },
      role: "client",
      canManage: false,
      canOverride: false,
    };
  }

  const projectId = typeof input.projectId === "string" && UUID_RE.test(input.projectId) ? input.projectId : null;
  if (!projectId) return null;
  const profile = await getProfile();
  if (!profile) return null;
  const tenant = await getTenantContext();
  if (!tenant || tenant.isSharedViewer) return null;
  if (!(await canAccessProject(profile, projectId))) return null;

  if (profile.role === "client") {
    return {
      businessId: tenant.businessId,
      projectId,
      actor: { kind: "client", userId: profile.id },
      role: "client",
      canManage: false,
      canOverride: false,
    };
  }
  const readOnly = Boolean(tenant.impersonating && !tenant.allowWrites);
  const canManage = !readOnly && (isOwnerAdmin(profile) || staffCan(profile, "scheduling.confirm"));
  if (!isOwnerAdmin(profile) && !staffCan(profile, "scheduling.propose") && !canManage) return null;
  return {
    businessId: tenant.businessId,
    projectId,
    actor: { kind: "business", userId: profile.id },
    role: "business",
    canManage,
    // Overrides are owner/admin only.
    canOverride: !readOnly && isOwnerAdmin(profile),
  };
}
