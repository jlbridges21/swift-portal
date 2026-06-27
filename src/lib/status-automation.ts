import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { getStatusLabel, getStatusOrder, normalizeStatus } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/constants";
import { clientStatusNotification } from "@/lib/client-messages";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import type { NotificationEventKey } from "@/lib/app-settings";
import {
  canAutoTransition,
  statusToWorkflowStage,
} from "@/lib/workflow-settings";
import { logWorkflowAudit } from "@/lib/workflow";

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
  /** Admin manual override — bypasses workflow auto-advance guards */
  manualOverride?: boolean;
  /** Skip workflow automation audit log */
  skipWorkflowAudit?: boolean;
}

export async function setProjectStatus(options: SetStatusOptions) {
  const supabase = await createServiceClient();
  const appSettings = await getAppSettings();
  const workflow = appSettings.workflow;

  const { data: existing } = await supabase
    .from("projects")
    .select("status")
    .eq("id", options.projectId)
    .single();

  if (options.skipIfSame && existing?.status === options.status) {
    return existing;
  }

  const fromStatus = normalizeStatus(existing?.status ?? "new_request");
  const toStatus = options.status;

  const currentOrder = getStatusOrder(fromStatus);
  const targetOrder = getStatusOrder(toStatus);

  if (
    !options.manualOverride &&
    existing?.status &&
    fromStatus !== toStatus &&
    targetOrder < currentOrder
  ) {
    await logWorkflowAudit(
      options.projectId,
      `Workflow blocked backward move from "${getStatusLabel(fromStatus)}" to "${getStatusLabel(toStatus)}" — automations only advance projects forward.`,
      {
        userId: options.userId,
        idempotencyKey: options.idempotencyKey
          ? `${options.idempotencyKey}:backward-blocked`
          : `workflow:backward:${options.projectId}:${toStatus}`,
        metadata: { from: fromStatus, to: toStatus, blocked: true, reason: "backward" },
      }
    );
    return existing;
  }

  if (
    !options.manualOverride &&
    existing?.status &&
    fromStatus !== toStatus &&
    !canAutoTransition(fromStatus, toStatus, workflow, false)
  ) {
    await logWorkflowAudit(
      options.projectId,
      `Workflow blocked automatic move to "${getStatusLabel(toStatus)}" — manual approval required or auto-advance disabled.`,
      {
        userId: options.userId,
        idempotencyKey: options.idempotencyKey
          ? `${options.idempotencyKey}:blocked`
          : `workflow:blocked:${options.projectId}:${toStatus}`,
        metadata: { from: fromStatus, to: toStatus, blocked: true },
      }
    );
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
  const stageKey = statusToWorkflowStage(options.status);
  const stageSettings = workflow.stages[stageKey];
  const automated = !options.manualOverride && fromStatus !== toStatus;

  if (stageSettings?.logActivity !== false) {
    await logProjectActivity(
      options.activityType || "status_updated",
      options.activityDescription || `Status updated to ${label}`,
      {
        projectId: options.projectId,
        userId: options.userId ?? null,
        idempotencyKey:
          options.idempotencyKey ??
          `status:${options.projectId}:${options.activityType || options.status}`,
        metadata: { from: existing?.status, to: options.status, automated },
      }
    );
  }

  if (automated && !options.skipWorkflowAudit) {
    await logWorkflowAudit(
      options.projectId,
      `Workflow automatically moved project to ${label}.`,
      {
        userId: options.userId,
        idempotencyKey: `workflow:status:${options.projectId}:${toStatus}`,
        metadata: { from: fromStatus, to: toStatus, stage: stageKey },
      }
    );
  }

  const allowNotify =
    stageSettings?.inApp !== false ||
    stageSettings?.email !== false ||
    stageSettings?.push !== false;

  if (options.notifyClient && allowNotify) {
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
  } else if (options.notifyClient && !allowNotify) {
    await logWorkflowAudit(
      options.projectId,
      `Client notification skipped for "${label}" — disabled in Workflow Settings.`,
      {
        idempotencyKey: `workflow:notify-skipped:client:${options.projectId}:${toStatus}`,
        metadata: { skipped: true },
      }
    );
  }

  if (options.notifyAdmin && allowNotify) {
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
