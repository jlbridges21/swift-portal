import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { getStatusLabel, getStatusOrder, normalizeStatus } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/constants";
import { clientStatusNotification } from "@/lib/client-messages";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import type { NotificationEventKey } from "@/lib/app-settings";

interface SetStatusOptions {
  projectId: string;
  status: ProjectStatus;
  userId?: string | null;
  activityDescription?: string;
  activityType?: string;
  notifyClient?: boolean;
  notifyAdmin?: boolean;
  skipIfSame?: boolean;
  idempotencyKey?: string;
  link?: string;
  clientTitle?: string;
  clientBody?: string;
  clientEventKey?: NotificationEventKey;
  adminEventKey?: NotificationEventKey;
}

export async function setProjectStatus(options: SetStatusOptions) {
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("projects")
    .select("status")
    .eq("id", options.projectId)
    .single();

  if (options.skipIfSame && existing?.status === options.status) {
    return existing;
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ status: options.status })
    .eq("id", options.projectId)
    .select()
    .single();

  if (error) throw error;

  const label = getStatusLabel(options.status);
  await logProjectActivity(
    options.activityType || "status_updated",
    options.activityDescription || `Status updated to ${label}`,
    {
      projectId: options.projectId,
      userId: options.userId ?? null,
      idempotencyKey:
        options.idempotencyKey ??
        `status:${options.projectId}:${options.activityType || options.status}`,
      metadata: { from: existing?.status, to: options.status },
    }
  );

  if (options.notifyClient) {
    const clientMsg = clientStatusNotification(options.status);
    const clientType = options.status === "awaiting_payment" ? "invoice_available" : "status_changed";
    await notifyProjectClients({
      type: clientType,
      eventKey: options.clientEventKey,
      title: options.clientTitle ?? clientMsg.title,
      body: options.clientBody ?? clientMsg.body,
      link: options.link || `/dashboard/projects/${options.projectId}`,
      projectId: options.projectId,
    });
  }

  if (options.notifyAdmin) {
    const deliverablesApproved = options.activityType === "deliverables_approved";
    await notifyAdmins({
      type: "status_changed",
      eventKey: options.adminEventKey,
      title: deliverablesApproved ? "Deliverables Approved" : `Project update: ${label}`,
      body: deliverablesApproved
        ? "The client approved all deliverables. Final payment is next."
        : `Project moved to "${label}".`,
      link: `/admin/projects/${options.projectId}`,
      projectId: options.projectId,
    });
  }

  return data;
}

/** Updates project status only when moving forward in the workflow (never regresses). */
export async function setProjectStatusForward(
  options: SetStatusOptions
): Promise<{ status: string } | null> {
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("projects")
    .select("status")
    .eq("id", options.projectId)
    .single();

  const currentOrder = getStatusOrder(normalizeStatus(existing?.status ?? "new_request"));
  const targetOrder = getStatusOrder(options.status);

  if (targetOrder < currentOrder) {
    return existing;
  }

  return setProjectStatus(options);
}
