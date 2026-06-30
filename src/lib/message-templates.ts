import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { MessageTemplateKey } from "@/lib/workflow-settings";

function portalLink(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path}`;
}

export interface WorkflowMessageVariables {
  client_name: string;
  project_name: string;
  property_address: string;
  portal_link: string;
  payment_amount: string;
  shoot_date: string;
}

export const WORKFLOW_VARIABLE_FALLBACKS: WorkflowMessageVariables = {
  client_name: "there",
  project_name: "your project",
  property_address: "your property",
  portal_link: "",
  payment_amount: "",
  shoot_date: "",
};

const REQUIRED_FOR_QUALITY: (keyof WorkflowMessageVariables)[] = [
  "client_name",
  "project_name",
];

function trimValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Replace {{variable}} placeholders with safe fallbacks and warn on missing required values. */
export function renderWorkflowTemplate(
  template: string,
  variables: Partial<WorkflowMessageVariables>,
  options?: { workflowKey?: MessageTemplateKey | string }
): string {
  const workflowKey = options?.workflowKey ?? "unknown";
  const resolved: WorkflowMessageVariables = { ...WORKFLOW_VARIABLE_FALLBACKS };

  for (const key of Object.keys(WORKFLOW_VARIABLE_FALLBACKS) as (keyof WorkflowMessageVariables)[]) {
    const raw = trimValue(variables[key]);
    if (raw) {
      resolved[key] = raw;
      continue;
    }

    if (REQUIRED_FOR_QUALITY.includes(key)) {
      console.warn(
        `[message-templates] missing ${key} for workflow "${workflowKey}" — using fallback "${resolved[key]}"`
      );
    }
  }

  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const k = key as keyof WorkflowMessageVariables;
    if (k in resolved) return resolved[k];
    return "";
  });

  return rendered.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

function resolveClientDisplayName(client: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
} | null): string {
  if (!client) return "";
  const first = trimValue(client.first_name);
  const last = trimValue(client.last_name);
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return trimValue(client.full_name) || trimValue(client.name);
}

export async function buildProjectMessageVariables(
  projectId: string,
  overrides: Partial<WorkflowMessageVariables> & { portal_path?: string } = {}
): Promise<WorkflowMessageVariables> {
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("project_name, property_address, shoot_date, client_id")
    .eq("id", projectId)
    .maybeSingle();

  let clientName = "";
  if (project?.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name, full_name, first_name, last_name")
      .eq("id", project.client_id)
      .maybeSingle();
    clientName = resolveClientDisplayName(client);
  }

  const portalPath = overrides.portal_path ?? `/dashboard/projects/${projectId}`;
  const portalLinkValue = trimValue(overrides.portal_link) || portalLink(portalPath);

  return {
    client_name: trimValue(overrides.client_name) || clientName,
    project_name: trimValue(overrides.project_name) || trimValue(project?.project_name),
    property_address: trimValue(overrides.property_address) || trimValue(project?.property_address),
    portal_link: portalLinkValue,
    payment_amount: trimValue(overrides.payment_amount),
    shoot_date:
      trimValue(overrides.shoot_date) ||
      (project?.shoot_date ? formatDate(project.shoot_date) : ""),
  };
}
