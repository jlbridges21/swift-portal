import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { notifyClient } from "@/lib/notifications";
import { ensureClientPortalAccessForEmail } from "@/lib/client-portal-link";
import { idempotencyKey } from "@/lib/idempotency";

/**
 * Notify a client that an admin added them to a project.
 *
 * Suppression:
 * - Skip if they were already on the project (upsert / set-primary).
 * - Skip if they are the first client on the project (request creator / primary).
 * - Skip re-notify after remove+re-add via activity_logs idempotency key
 *   `client_added_notify:{projectId}:{clientId}` (once per project+client pair).
 */
export async function notifyClientAddedToProject(options: {
  businessId: string;
  projectId: string;
  clientId: string;
  /** True when this client already had a project_clients row before the upsert. */
  wasAlreadyOnProject: boolean;
  /** project_clients count before this assignment. */
  priorClientCount: number;
}): Promise<{ notified: boolean; reason?: string; portalMechanism?: string }> {
  if (options.wasAlreadyOnProject) {
    return { notified: false, reason: "already_on_project" };
  }
  if (options.priorClientCount === 0) {
    return { notified: false, reason: "request_creator_or_first_client" };
  }

  const key = idempotencyKey("client_added_notify", options.projectId, options.clientId);
  const db = await createTenantServiceClient(options.businessId);
  const { data: priorNotify } = await db
    .from("activity_logs")
    .select("id")
    .eq("idempotency_key", key)
    .eq("project_id", options.projectId)
    .maybeSingle();

  if (priorNotify?.id) {
    return { notified: false, reason: "already_notified_for_pair" };
  }

  const { data: project } = await db
    .from("projects")
    .select("id, project_name, status")
    .eq("id", options.projectId)
    .maybeSingle();

  if (!project) {
    return { notified: false, reason: "project_not_found" };
  }

  const nextPath = `/dashboard/projects/${options.projectId}`;
  const portal = await ensureClientPortalAccessForEmail(
    options.clientId,
    options.businessId,
    nextPath
  );

  const projectLabel = project.project_name?.trim() || "your project";
  const isInvite = portal.mechanism === "supabase_invite_generate_link";

  await notifyClient({
    businessId: options.businessId,
    clientId: options.clientId,
    projectId: options.projectId,
    type: "client_added_to_project",
    eventKey: "client_added_to_project",
    title: `You've been added to ${projectLabel}`,
    body: isInvite
      ? `You've been given access to ${projectLabel}. Use the button below to set up your portal login and open the project.`
      : `You've been given access to ${projectLabel}. Open the project in your portal to review details, messages, and deliverables.`,
    link: portal.ctaUrl,
  });

  await logProjectActivity(
    "client_added_to_project",
    `Notified client they were added to ${projectLabel}`,
    {
      businessId: options.businessId,
      projectId: options.projectId,
      clientId: options.clientId,
      visibility: "admin",
      idempotencyKey: key,
      metadata: {
        clientId: options.clientId,
        portalMechanism: portal.mechanism,
      },
    }
  );

  return {
    notified: true,
    portalMechanism: portal.mechanism,
  };
}
