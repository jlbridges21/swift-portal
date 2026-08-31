import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type ProjectAccessKind = "admin" | "assigned_client" | "share" | "denied";

export type ProjectAccessResult = {
  allowed: boolean;
  kind: ProjectAccessKind;
  businessId?: string;
  shareId?: string;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v || null;
}

function isBusinessAdmin(profile: Profile, businessId: string): boolean {
  return (
    (profile.role === "admin" || profile.role === "super_admin") &&
    profile.business_id === businessId
  );
}

async function assignedClientHasProject(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  profile: Profile,
  projectId: string,
  projectClientId: string | null
): Promise<boolean> {
  let clientId = profile.client_id;
  if (!clientId) {
    const { data: byUser } = await raw
      .from("clients")
      .select("id")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .limit(2);
    if ((byUser?.length ?? 0) === 1) {
      clientId = byUser![0].id;
    }
  }
  if (!clientId) return false;
  if (projectClientId === clientId) return true;
  const { data: junction } = await raw
    .from("project_clients")
    .select("id")
    .eq("project_id", projectId)
    .eq("client_id", clientId)
    .maybeSingle();
  return Boolean(junction);
}

/**
 * Single project access resolver — admin, assigned client (no share row required),
 * or active project_shares email match. Uses service client because shared viewers
 * sit outside tenant RLS (profiles.business_id NULL).
 */
export async function resolveProjectAccess(
  profile: Profile,
  projectId: string,
  options?: { tenantBusinessId?: string | null }
): Promise<ProjectAccessResult> {
  const raw = await createServiceClient();
  const { data: project, error } = await raw
    .from("projects")
    .select("id, business_id, client_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project || project.deleted_at) {
    return { allowed: false, kind: "denied" };
  }

  const businessId = project.business_id as string;

  if (profile.role === "super_admin") {
    if (options?.tenantBusinessId && options.tenantBusinessId === businessId) {
      return { allowed: true, kind: "admin", businessId };
    }
    return { allowed: false, kind: "denied" };
  }

  if (isBusinessAdmin(profile, businessId)) {
    return { allowed: true, kind: "admin", businessId };
  }

  if (await assignedClientHasProject(raw, profile, projectId, project.client_id)) {
    if (profile.business_id && profile.business_id !== businessId) {
      return { allowed: false, kind: "denied" };
    }
    return { allowed: true, kind: "assigned_client", businessId };
  }

  const email = normalizeEmail(profile.email);
  if (email) {
    const { data: share } = await raw
      .from("project_shares")
      .select(
        "id, revoked_at, access_mode, access_starts_at, access_expires_at, one_time_used_at"
      )
      .eq("project_id", projectId)
      .eq("email", email)
      .is("revoked_at", null)
      .maybeSingle();
    if (share) {
      const { validateShareAccessWindow } = await import("@/lib/project-share-access");
      if (validateShareAccessWindow(share).ok) {
        return { allowed: true, kind: "share", businessId, shareId: share.id as string };
      }
    }
  }

  return { allowed: false, kind: "denied" };
}

/** Backward-compatible boolean wrapper — all callers should use resolveProjectAccess. */
export async function canAccessProject(profile: Profile, projectId: string): Promise<boolean> {
  const result = await resolveProjectAccess(profile, projectId);
  return result.allowed;
}

/** Payments, invoices, and assigned-client-only surfaces. */
export async function canAccessProjectAsAssignedClientOrAdmin(
  profile: Profile,
  projectId: string
): Promise<boolean> {
  const result = await resolveProjectAccess(profile, projectId);
  return result.allowed && result.kind !== "share";
}

export async function touchProjectShareAccess(shareId: string): Promise<void> {
  const raw = await createServiceClient();
  await raw
    .from("project_shares")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", shareId)
    .is("revoked_at", null);
}
