import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import type { Profile, Project } from "@/lib/types";

export type ProjectLinkAccessMode = "restricted" | "anyone_with_link";

/** Shorter TTL for anonymous signed URLs — in-flight URLs expire sooner after Restricted. */
export const PUBLIC_LINK_SIGNED_TTL_SECONDS = 1800;

export type PublicLinkProjectContext = {
  projectId: string;
  businessId: string;
  project: Pick<
    Project,
    | "id"
    | "business_id"
    | "project_name"
    | "property_address"
    | "service_type"
    | "status"
    | "delivery_date"
    | "cover_image_url"
    | "cover_image_id"
    | "link_access_mode"
    | "link_access_token"
    | "link_access_view_count"
  >;
};

function generateLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Single resolver for anonymous public-link access.
 * ONLY input from the caller is the URL token — business/project come from the row.
 * Optional hostBusinessId must match project.business_id (wrong host → null).
 */
export async function resolvePublicLinkProject(
  token: string,
  hostBusinessId?: string | null
): Promise<PublicLinkProjectContext | null> {
  const trimmed = token?.trim();
  if (!trimmed) return null;

  const raw = await createServiceClient();
  const { data: project, error } = await raw
    .from("projects")
    .select(
      "id, business_id, project_name, property_address, service_type, status, delivery_date, cover_image_url, cover_image_id, link_access_mode, link_access_token, link_access_view_count, deleted_at"
    )
    .eq("link_access_token", trimmed)
    .eq("link_access_mode", "anyone_with_link")
    .maybeSingle();

  if (error || !project || project.deleted_at) return null;
  const businessId = project.business_id as string;
  if (hostBusinessId && hostBusinessId !== businessId) return null;

  return {
    projectId: project.id as string,
    businessId,
    project: {
      id: project.id as string,
      business_id: businessId,
      project_name: project.project_name as string,
      property_address: project.property_address as string,
      service_type: project.service_type as string,
      status: project.status as Project["status"],
      delivery_date: project.delivery_date as string | null,
      cover_image_url: project.cover_image_url as string | null,
      cover_image_id: project.cover_image_id as string | null,
      link_access_mode: project.link_access_mode as ProjectLinkAccessMode,
      link_access_token: project.link_access_token as string,
      link_access_view_count: Number(project.link_access_view_count ?? 0),
    },
  };
}

export async function incrementPublicLinkViewCount(
  projectId: string,
  businessId: string
): Promise<void> {
  const raw = await createServiceClient();
  const { data: row } = await raw
    .from("projects")
    .select("link_access_view_count")
    .eq("id", projectId)
    .eq("business_id", businessId)
    .eq("link_access_mode", "anyone_with_link")
    .maybeSingle();
  if (!row) return;
  await raw
    .from("projects")
    .update({ link_access_view_count: Number(row.link_access_view_count ?? 0) + 1 })
    .eq("id", projectId)
    .eq("business_id", businessId);
}

export function buildPublicProjectViewPath(token: string): string {
  return `/view/${encodeURIComponent(token)}`;
}

export function buildPublicProjectViewUrl(portalOrigin: string, token: string): string {
  return `${portalOrigin.replace(/\/$/, "")}${buildPublicProjectViewPath(token)}`;
}

export async function buildPublicProjectViewUrlForBusiness(
  businessId: string,
  biz: { slug: string; custom_domain: string | null },
  token: string
): Promise<string> {
  const { getBusinessPortalOriginById, joinPortalPath, getDeploymentOrigin } = await import(
    "@/lib/portal-url"
  );
  const dep = getDeploymentOrigin();
  let depHost = "localhost";
  try {
    depHost = new URL(dep).hostname;
  } catch {
    /* keep default */
  }
  if ((depHost === "localhost" || depHost === "127.0.0.1") && biz.slug) {
    return `${dep.replace(/\/$/, "")}/b/${biz.slug}${buildPublicProjectViewPath(token)}`;
  }
  const origin = await getBusinessPortalOriginById(businessId);
  return joinPortalPath(origin, buildPublicProjectViewPath(token));
}

export async function getProjectLinkAccessState(
  businessId: string,
  projectId: string
): Promise<{
  mode: ProjectLinkAccessMode;
  token: string | null;
  enabledAt: string | null;
  viewCount: number;
  publicUrl: string | null;
}> {
  const raw = await createServiceClient();
  const { data: project } = await raw
    .from("projects")
    .select(
      "link_access_mode, link_access_token, link_access_enabled_at, link_access_view_count"
    )
    .eq("id", projectId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!project) {
    return { mode: "restricted", token: null, enabledAt: null, viewCount: 0, publicUrl: null };
  }
  const { data: biz } = await raw
    .from("businesses")
    .select("slug, custom_domain")
    .eq("id", businessId)
    .maybeSingle();
  const mode = (project.link_access_mode as ProjectLinkAccessMode) ?? "restricted";
  const token = (project.link_access_token as string | null) ?? null;
  const publicUrl =
    mode === "anyone_with_link" && token && biz
      ? await buildPublicProjectViewUrlForBusiness(businessId, biz, token)
      : null;
  return {
    mode,
    token,
    enabledAt: (project.link_access_enabled_at as string | null) ?? null,
    viewCount: Number(project.link_access_view_count ?? 0),
    publicUrl,
  };
}

export async function setProjectLinkAccessMode(
  businessId: string,
  projectId: string,
  mode: ProjectLinkAccessMode,
  actor: Profile
): Promise<{ mode: ProjectLinkAccessMode; token: string | null; publicUrl: string | null }> {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("projects")
    .select("id, project_name, link_access_mode, link_access_token")
    .eq("id", projectId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Project not found.");

  const now = new Date().toISOString();
  let token = (existing.link_access_token as string | null) ?? null;

  if (mode === "anyone_with_link") {
    if (!token) token = generateLinkToken();
    await raw
      .from("projects")
      .update({
        link_access_mode: "anyone_with_link",
        link_access_token: token,
        link_access_enabled_at: now,
        link_access_enabled_by: actor.id,
      })
      .eq("id", projectId)
      .eq("business_id", businessId);

    const { createTenantServiceClient } = await import("@/lib/supabase/tenant-service");
    await logProjectActivity("link_access_enabled", "Project link set to Anyone with link", {
      businessId,
      projectId,
      userId: actor.id,
      visibility: "admin",
      metadata: { mode: "anyone_with_link" },
    });
  } else {
    await raw
      .from("projects")
      .update({
        link_access_mode: "restricted",
      })
      .eq("id", projectId)
      .eq("business_id", businessId);

    await logProjectActivity(
      "link_access_restricted",
      "Project link set to Restricted — anonymous access blocked immediately",
      {
        businessId,
        projectId,
        userId: actor.id,
        visibility: "admin",
        metadata: { mode: "restricted" },
      }
    );
  }

  const state = await getProjectLinkAccessState(businessId, projectId);
  return { mode: state.mode, token: state.token, publicUrl: state.publicUrl };
}

/**
 * Issue a new anonymous link token. Previous URLs stop working immediately.
 * Requires link access to already be "anyone_with_link".
 */
export async function rotateProjectLinkToken(
  businessId: string,
  projectId: string,
  actor: Profile
): Promise<{ token: string; publicUrl: string | null }> {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("projects")
    .select("id, project_name, link_access_mode")
    .eq("id", projectId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Project not found.");
  if ((existing.link_access_mode as ProjectLinkAccessMode) !== "anyone_with_link") {
    throw new Error("Enable Anyone with link before generating a new link.");
  }

  const token = generateLinkToken();
  const now = new Date().toISOString();
  await raw
    .from("projects")
    .update({
      link_access_token: token,
      link_access_enabled_at: now,
      link_access_enabled_by: actor.id,
    })
    .eq("id", projectId)
    .eq("business_id", businessId);

  await logProjectActivity(
    "link_access_token_rotated",
    "Public project link rotated — previous anonymous URLs no longer work",
    {
      businessId,
      projectId,
      userId: actor.id,
      visibility: "admin",
      metadata: { mode: "anyone_with_link" },
    }
  );

  const state = await getProjectLinkAccessState(businessId, projectId);
  return { token, publicUrl: state.publicUrl };
}

/** Authenticated comment access on a public project — requires matching link token (no dashboard widening). */
export async function canCommentViaPublicLink(
  projectId: string,
  linkToken: string | null | undefined
): Promise<boolean> {
  if (!linkToken?.trim()) return false;
  const ctx = await resolvePublicLinkProject(linkToken.trim());
  return Boolean(ctx && ctx.projectId === projectId);
}
