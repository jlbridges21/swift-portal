import { getAppSettings } from "@/lib/app-settings";
import { logProjectActivity } from "@/lib/activity";
import { mergeWorkflowSettings, type MessageTemplateKey, type WorkflowSettings } from "@/lib/workflow-settings";

export interface TemplateContext {
  client_name?: string;
  property_address?: string;
  project_name?: string;
  shoot_date?: string;
  payment_amount?: string;
  portal_link?: string;
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
  const settings = await getAppSettings();
  return settings.workflow;
}

export function interpolateTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = context[key as keyof TemplateContext];
    return value ?? "";
  });
}

export function resolveMessageTemplate(
  workflow: WorkflowSettings,
  key: MessageTemplateKey,
  context: TemplateContext,
  fallback: string
): string {
  const template = workflow.messages[key]?.trim();
  if (!template) return fallback;
  const text = interpolateTemplate(template, context);
  return text || fallback;
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

export { mergeWorkflowSettings };
