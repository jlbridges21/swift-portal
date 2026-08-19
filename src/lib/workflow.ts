import { getAppSettings } from "@/lib/app-settings";
import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import type { MessageTemplateKey, WorkflowSettings } from "@/lib/workflow-settings";
import {
  renderWorkflowTemplate,
  buildProjectMessageVariables,
  type WorkflowMessageVariables,
} from "@/lib/message-templates";
import { businessPortalHref } from "@/lib/portal-url";

export type TemplateContext = Partial<WorkflowMessageVariables>;

export async function getWorkflowSettings(businessId: string): Promise<WorkflowSettings> {
  const settings = await getAppSettings(businessId);
  return settings.workflow;
}

export function interpolateTemplate(template: string, context: TemplateContext): string {
  return renderWorkflowTemplate(template, context);
}

export function resolveMessageTemplate(
  workflow: WorkflowSettings,
  key: MessageTemplateKey,
  context: TemplateContext,
  fallback: string
): string {
  const template = workflow.messages[key]?.body?.trim();
  if (!template) return fallback;
  const text = renderWorkflowTemplate(template, context, { workflowKey: key });
  return text || fallback;
}

export function resolveMessageSubject(
  workflow: WorkflowSettings,
  key: MessageTemplateKey,
  context: TemplateContext,
  fallback: string
): string {
  const template = workflow.messages[key]?.subject?.trim();
  if (!template) return fallback;
  const text = renderWorkflowTemplate(template, context, { workflowKey: key });
  return text || fallback;
}

export async function resolveProjectEmailTemplate(
  workflow: WorkflowSettings,
  key: MessageTemplateKey,
  projectId: string,
  partial: TemplateContext = {},
  fallbacks: { subject: string; body: string }
): Promise<{ subject: string; body: string }> {
  const variables = await buildProjectMessageVariables(projectId, partial);
  const merged: TemplateContext = {
    ...variables,
    ...Object.fromEntries(
      Object.entries(partial).filter(([, v]) => typeof v === "string" && v.trim())
    ),
  };
  return {
    subject: resolveMessageSubject(workflow, key, merged, fallbacks.subject),
    body: resolveMessageTemplate(workflow, key, merged, fallbacks.body),
  };
}

export async function resolveProjectMessageTemplate(
  workflow: WorkflowSettings,
  key: MessageTemplateKey,
  projectId: string,
  partial: TemplateContext = {},
  fallback: string
): Promise<string> {
  const variables = await buildProjectMessageVariables(projectId, partial);
  const merged: TemplateContext = {
    ...variables,
    ...Object.fromEntries(
      Object.entries(partial).filter(([, v]) => typeof v === "string" && v.trim())
    ),
  };
  return resolveMessageTemplate(workflow, key, merged, fallback);
}

async function resolveProjectBusinessId(projectId: string): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("projects")
    .select("business_id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.business_id ?? null;
}

export async function logWorkflowAudit(
  projectId: string,
  description: string,
  options?: {
    userId?: string | null;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    skipped?: boolean;
  }
) {
  const businessId = await resolveProjectBusinessId(projectId);
  if (!businessId) {
    console.error("[workflow] skipped audit — project missing business_id", { projectId });
    return null;
  }

  const workflow = await getWorkflowSettings(businessId);
  const stageKey = options?.metadata?.stage as string | undefined;
  if (stageKey && workflow.stages[stageKey as keyof typeof workflow.stages]?.logActivity === false) {
    return null;
  }

  return logProjectActivity("workflow_automation", description, {
    businessId,
    projectId,
    userId: options?.userId ?? null,
    idempotencyKey: options?.idempotencyKey,
    metadata: { automated: true, ...options?.metadata },
  });
}

export async function logWorkflowSkipped(
  projectId: string,
  reason: string,
  idempotencyKey?: string
) {
  return logWorkflowAudit(projectId, reason, {
    idempotencyKey: idempotencyKey ?? `workflow:skipped:${projectId}:${reason.slice(0, 40)}`,
    metadata: { skipped: true },
  });
}

export async function portalLink(path: string, businessId: string): Promise<string> {
  return businessPortalHref(businessId, path);
}

export { mergeWorkflowSettings } from "@/lib/workflow-settings";
