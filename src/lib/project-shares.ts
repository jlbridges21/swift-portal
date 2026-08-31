import { createServiceClient } from "@/lib/supabase/server";
import { buildAuthConfirmLink } from "@/lib/auth-confirm";
import { sendBrandedEmail } from "@/lib/email";
import { getBusinessPortalOriginById, joinPortalPath } from "@/lib/portal-url";
import type { Profile } from "@/lib/types";

export type ProjectShareRow = {
  id: string;
  business_id: string;
  project_id: string;
  email: string;
  invited_by: string | null;
  invited_at: string;
  notified_at: string | null;
  last_accessed_at: string | null;
  revoked_at: string | null;
};

export function normalizeShareEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidShareEmail(email: string): boolean {
  const normalized = normalizeShareEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export async function findProfileIdByEmail(email: string): Promise<string | null> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(email);
  const { data } = await raw.from("profiles").select("id, email").ilike("email", normalized);
  const match = (data ?? []).find(
    (row) => normalizeShareEmail(String(row.email || "")) === normalized
  );
  return match?.id ?? null;
}

export async function listProjectShares(
  businessId: string,
  projectId: string
): Promise<ProjectShareRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("project_shares")
    .select("*")
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .order("invited_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectShareRow[];
}

export async function listActiveShareProjectIdsForEmail(
  email: string,
  businessId?: string
): Promise<string[]> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(email);
  let query = raw
    .from("project_shares")
    .select("project_id")
    .eq("email", normalized)
    .is("revoked_at", null);
  if (businessId) {
    query = query.eq("business_id", businessId);
  }
  const { data: shares, error } = await query;
  if (error) throw new Error(error.message);
  const projectIds = [...new Set((shares ?? []).map((row) => row.project_id as string))];
  if (projectIds.length === 0) return [];
  const { data: projects } = await raw
    .from("projects")
    .select("id")
    .in("id", projectIds)
    .is("deleted_at", null);
  return (projects ?? []).map((p) => p.id as string);
}

export async function listSharedBusinessIdsForEmail(email: string): Promise<string[]> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(email);
  const { data: shares, error } = await raw
    .from("project_shares")
    .select("business_id, project_id")
    .eq("email", normalized)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  if ((shares ?? []).length === 0) return [];
  const projectIds = [...new Set((shares ?? []).map((s) => s.project_id as string))];
  const { data: projects } = await raw
    .from("projects")
    .select("id")
    .in("id", projectIds)
    .is("deleted_at", null);
  const liveIds = new Set((projects ?? []).map((p) => p.id as string));
  const businessIds = new Set<string>();
  for (const row of shares ?? []) {
    if (liveIds.has(row.project_id as string)) {
      businessIds.add(row.business_id as string);
    }
  }
  return [...businessIds];
}

export async function userHasShareOnBusiness(
  email: string,
  businessId: string
): Promise<boolean> {
  const ids = await listActiveShareProjectIdsForEmail(email, businessId);
  return ids.length > 0;
}

async function ensureAuthUserForShareEmail(email: string): Promise<{ userId: string | null }> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(email);
  const existingProfileId = await findProfileIdByEmail(normalized);
  if (existingProfileId) {
    return { userId: existingProfileId };
  }

  const created = await raw.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { role: "client", full_name: normalized.split("@")[0] },
  });
  if (created.error) {
    if (/already registered|already exists/i.test(created.error.message)) {
      const { data: users } = await raw.auth.admin.listUsers();
      const found = users.users.find(
        (u) => normalizeShareEmail(u.email ?? "") === normalized
      );
      return { userId: found?.id ?? null };
    }
    throw new Error(created.error.message);
  }
  return { userId: created.data.user?.id ?? null };
}

async function buildShareMagicLink(options: {
  businessId: string;
  projectId: string;
  email: string;
}): Promise<string> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(options.email);
  await ensureAuthUserForShareEmail(normalized);

  const portalOrigin = await getBusinessPortalOriginById(options.businessId);
  const nextPath = `/dashboard/projects/${options.projectId}`;

  const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
    options: { redirectTo: joinPortalPath(portalOrigin, "/auth/confirm") },
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(linkError?.message || "Could not generate share sign-in link.");
  }

  return buildAuthConfirmLink({
    portalOrigin,
    tokenHash: linkData.properties.hashed_token,
    type: "magiclink",
    nextPath,
  });
}

/** Exported for resend flows and verification scripts. */
export async function buildShareMagicLinkForProject(options: {
  businessId: string;
  projectId: string;
  email: string;
}): Promise<string> {
  return buildShareMagicLink(options);
}

export async function resendProjectShareAuthLink(options: {
  email: string;
  businessId: string;
}): Promise<{ sent: boolean; projectId?: string; error?: string }> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(options.email);
  const projectIds = await listActiveShareProjectIdsForEmail(normalized, options.businessId);
  if (projectIds.length === 0) {
    return { sent: false };
  }

  const { data: shareRow } = await raw
    .from("project_shares")
    .select("project_id")
    .eq("email", normalized)
    .eq("business_id", options.businessId)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const projectId = shareRow?.project_id as string | undefined;
  if (!projectId) return { sent: false };

  const { data: project } = await raw
    .from("projects")
    .select("project_name")
    .eq("id", projectId)
    .maybeSingle();

  const result = await sendProjectShareInviteEmail({
    businessId: options.businessId,
    projectId,
    projectName: project?.project_name || "Shared project",
    email: normalized,
    inviterName: "ShootPortal",
  });

  if (!result.sent) {
    return { sent: false, error: result.error ?? "Could not send share sign-in email." };
  }

  return { sent: true, projectId };
}

export async function sendProjectShareInviteEmail(options: {
  businessId: string;
  projectId: string;
  projectName: string;
  email: string;
  inviterName: string;
}): Promise<{ sent: boolean; signInUrl: string; error?: string }> {
  const signInUrl = await buildShareMagicLink({
    businessId: options.businessId,
    projectId: options.projectId,
    email: options.email,
  });

  const existingProfile = await findProfileIdByEmail(options.email);
  const subject = existingProfile
    ? `View shared project: ${options.projectName}`
    : `You're invited to view ${options.projectName}`;

  const result = await sendBrandedEmail({
    businessId: options.businessId,
    to: normalizeShareEmail(options.email),
    subject,
    title: existingProfile ? "A project was shared with you" : "View a shared project",
    body: existingProfile
      ? `${options.inviterName} shared "${options.projectName}" with you. Sign in with one click — no password needed.`
      : `${options.inviterName} shared "${options.projectName}" with you. Open the link to sign in passwordlessly and view the project.`,
    ctaLabel: "Open project",
    ctaUrl: signInUrl,
    emailType: "project_share_invite",
  });

  return {
    sent: result.sent,
    signInUrl,
    error: result.error,
  };
}

export type AddProjectShareInput = {
  businessId: string;
  projectId: string;
  email: string;
  invitedBy: string;
  notify: boolean;
  projectName: string;
  inviterName: string;
};

export type AddProjectShareResult = {
  share: ProjectShareRow;
  created: boolean;
  notified: boolean;
  notifyError?: string | null;
  signInUrl?: string | null;
  linkedExistingUser: boolean;
};

export async function addProjectShare(input: AddProjectShareInput): Promise<AddProjectShareResult> {
  const raw = await createServiceClient();
  const email = normalizeShareEmail(input.email);
  if (!isValidShareEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  const { data: existing } = await raw
    .from("project_shares")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("email", email)
    .maybeSingle();

  let share: ProjectShareRow;
  let created = false;

  if (existing) {
    if (!existing.revoked_at) {
      share = existing as ProjectShareRow;
    } else {
      const { data: revived, error: reviveError } = await raw
        .from("project_shares")
        .update({
          revoked_at: null,
          invited_by: input.invitedBy,
          invited_at: new Date().toISOString(),
          notified_at: null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (reviveError || !revived) throw new Error(reviveError?.message || "Could not restore share.");
      share = revived as ProjectShareRow;
      created = false;
    }
  } else {
    const { data: inserted, error: insertError } = await raw
      .from("project_shares")
      .insert({
        business_id: input.businessId,
        project_id: input.projectId,
        email,
        invited_by: input.invitedBy,
      })
      .select("*")
      .single();
    if (insertError || !inserted) throw new Error(insertError?.message || "Could not add share.");
    share = inserted as ProjectShareRow;
    created = true;
  }

  const linkedExistingUser = Boolean(await findProfileIdByEmail(email));
  let notified = false;
  let notifyError: string | null = null;
  let signInUrl: string | null = null;

  if (input.notify) {
    const emailResult = await sendProjectShareInviteEmail({
      businessId: input.businessId,
      projectId: input.projectId,
      projectName: input.projectName,
      email,
      inviterName: input.inviterName,
    });
    notified = emailResult.sent;
    notifyError = emailResult.error ?? null;
    signInUrl = emailResult.signInUrl;
    if (notified) {
      await raw
        .from("project_shares")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", share.id);
    }
  }

  return {
    share,
    created,
    notified,
    notifyError,
    signInUrl,
    linkedExistingUser,
  };
}

export async function revokeProjectShare(
  businessId: string,
  projectId: string,
  shareId: string
): Promise<void> {
  const raw = await createServiceClient();
  const { error } = await raw
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}

export async function resolveSharedViewerContext(
  profile: Profile,
  businessId: string
): Promise<{ isSharedViewer: boolean; sharedProjectIds: string[] }> {
  if (profile.business_id || profile.role === "admin" || profile.role === "super_admin") {
    return { isSharedViewer: false, sharedProjectIds: [] };
  }
  if (profile.client_id) {
    return { isSharedViewer: false, sharedProjectIds: [] };
  }
  const sharedProjectIds = await listActiveShareProjectIdsForEmail(profile.email, businessId);
  return {
    isSharedViewer: sharedProjectIds.length > 0,
    sharedProjectIds,
  };
}
