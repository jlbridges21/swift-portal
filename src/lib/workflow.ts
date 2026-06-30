import { getAppSettings } from "@/lib/app-settings";
import { logProjectActivity } from "@/lib/activity";
import type { MessageTemplateKey, WorkflowSettings } from "@/lib/workflow-settings";
import {
  renderWorkflowTemplate,
  buildProjectMessageVariables,
  type WorkflowMessageVariables,
} from "@/lib/message-templates";

export type TemplateContext = Partial<WorkflowMessageVariables>;

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
  const settings = await getAppSettings();
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
  const template = workflow.messages[key]?.trim();
  if (!template) return fallback;
  const text = renderWorkflowTemplate(template, context, { workflowKey: key });
  return text || fallback;
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
  const workflow = await getWorkflowSettings();
  const stageKey = options?.metadata?.stage as string | undefined;
  if (stageKey && workflow.stages[stageKey as keyof typeof workflow.stages]?.logActivity === false) {
    return null;
  }

  return logProjectActivity("workflow_automation", description, {
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

export function portalLink(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path}`;
}

export { mergeWorkflowSettings } from "@/lib/workflow-settings";
