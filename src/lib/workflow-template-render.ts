/** Pure template interpolation — safe for client and server. */

export interface WorkflowMessageVariables {
  client_name: string;
  project_name: string;
  property_address: string;
  portal_link: string;
  portal_name: string;
  payment_amount: string;
  shoot_date: string;
  business_name: string;
}

export const WORKFLOW_VARIABLE_FALLBACKS: WorkflowMessageVariables = {
  client_name: "there",
  project_name: "your project",
  property_address: "your property",
  portal_link: "",
  portal_name: "the portal",
  payment_amount: "",
  shoot_date: "",
  business_name: "our team",
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
  options?: { workflowKey?: string }
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
