import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { formatDate } from "@/lib/utils";
import { businessPortalHref } from "@/lib/portal-url";
import {
  renderWorkflowTemplate,
  WORKFLOW_VARIABLE_FALLBACKS,
  type WorkflowMessageVariables,
} from "@/lib/workflow-template-render";

export {
  renderWorkflowTemplate,
  WORKFLOW_VARIABLE_FALLBACKS,
  type WorkflowMessageVariables,
} from "@/lib/workflow-template-render";

function trimValue(value: string | null | undefined): string {
  return (value ?? "").trim();
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
    .select("project_name, property_address, shoot_date, client_id, business_id")
    .eq("id", projectId)
    .maybeSingle();

  let clientName = "";
  if (project?.client_id && project.business_id) {
    const db = await createTenantServiceClient(project.business_id);
    const { data: client } = await db
      .from("clients")
      .select("name, full_name, first_name, last_name")
      .eq("id", project.client_id)
      .maybeSingle();
    clientName = resolveClientDisplayName(client);
  }

  const portalPath = overrides.portal_path ?? `/dashboard/projects/${projectId}`;
  const portalLinkValue =
    trimValue(overrides.portal_link) ||
    (project?.business_id ? await businessPortalHref(project.business_id, portalPath) : portalPath);

  let businessName = trimValue(overrides.business_name);
  let portalName = trimValue(overrides.portal_name);
  if ((!businessName || !portalName) && project?.business_id) {
    const settings = await getAppSettings(project.business_id);
    if (!businessName) businessName = settings.business.businessName;
    if (!portalName) portalName = settings.business.portalName || settings.business.businessName;
  }

  return {
    client_name: trimValue(overrides.client_name) || clientName,
    project_name: trimValue(overrides.project_name) || trimValue(project?.project_name),
    property_address: trimValue(overrides.property_address) || trimValue(project?.property_address),
    portal_link: portalLinkValue,
    portal_name: portalName,
    payment_amount: trimValue(overrides.payment_amount),
    shoot_date:
      trimValue(overrides.shoot_date) ||
      (project?.shoot_date ? formatDate(project.shoot_date) : ""),
    business_name: businessName,
  };
}
