import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";
import { buildPreliminaryEstimatePayload } from "@/lib/business-services";
import { getAppSettings, addProposalExpiration } from "@/lib/app-settings";

async function resolveProjectBusinessId(projectId: string): Promise<string | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("projects")
    .select("business_id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.business_id ?? null;
}

export async function upsertPreliminaryEstimate(
  projectId: string,
  serviceType: string,
  options?: { userId?: string | null; businessId?: string }
) {
  const businessId = options?.businessId || (await resolveProjectBusinessId(projectId));
  if (!businessId) {
    console.warn("[preliminary-estimate] skipped upsert — could not resolve businessId", { projectId });
    return null;
  }

  const appSettings = await getAppSettings(businessId);
  if (!appSettings.proposals.autoPreliminaryEstimate) {
    return null;
  }

  const db = await createTenantServiceClient(businessId);
  const payload = await buildPreliminaryEstimatePayload(serviceType, {
    portalName: appSettings.business.portalName,
    businessName: appSettings.business.businessName,
  }, businessId);
  const expiresAt = addProposalExpiration(
    new Date(),
    appSettings.proposals.defaultEstimateExpirationDays
  );

  const { data: existing } = await db
    .from("project_quotes")
    .select("id")
    .eq("project_id", projectId)
    .eq("quote_kind", "preliminary")
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await db
      .from("project_quotes")
      .update({
        title: payload.title,
        description: payload.description,
        line_items: payload.line_items,
        total_cents: payload.total_cents,
        notes: payload.notes,
        expires_at: expiresAt,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("[preliminary-estimate] failed to update:", error.message);
      return null;
    }
    return updated;
  }

  return createPreliminaryEstimate(projectId, serviceType, {
    userId: options?.userId,
    skipIfExists: false,
    businessId,
  });
}

export async function createPreliminaryEstimate(
  projectId: string,
  serviceType: string,
  options?: { userId?: string | null; skipIfExists?: boolean; businessId?: string }
) {
  const businessId = options?.businessId || (await resolveProjectBusinessId(projectId));
  if (!businessId) {
    console.warn("[preliminary-estimate] skipped create — could not resolve businessId", { projectId });
    return null;
  }

  const appSettings = await getAppSettings(businessId);
  if (!appSettings.proposals.autoPreliminaryEstimate) {
    return null;
  }

  const db = await createTenantServiceClient(businessId);

  if (options?.skipIfExists) {
    const { data: existing } = await db
      .from("project_quotes")
      .select("id")
      .eq("project_id", projectId)
      .eq("quote_kind", "preliminary")
      .maybeSingle();
    if (existing) return existing;
  }

  const payload = await buildPreliminaryEstimatePayload(serviceType, {
    portalName: appSettings.business.portalName,
    businessName: appSettings.business.businessName,
  }, businessId);
  const expiresAt = addProposalExpiration(
    new Date(),
    appSettings.proposals.defaultEstimateExpirationDays
  );

  const { data: quote, error } = await db
    .from("project_quotes")
    .insert({
      project_id: projectId,
      title: payload.title,
      description: payload.description,
      line_items: payload.line_items,
      total_cents: payload.total_cents,
      notes: payload.notes,
      status: "sent",
      quote_kind: "preliminary",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      created_by: options?.userId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[preliminary-estimate] failed to create:", error.message);
    return null;
  }

  await logProjectActivity(
    "preliminary_estimate_created",
    "📄 Preliminary Estimate created automatically",
    {
      businessId,
      projectId,
      userId: options?.userId ?? null,
      metadata: { quoteId: quote.id, serviceType },
    }
  );

  await notifyProjectClients({
    businessId,
    type: "status_changed",
    eventKey: "preliminary_estimate_created",
    title: "Your preliminary estimate is ready",
    body: `Your automatically generated preliminary estimate is ready to review in ${appSettings.business.portalName}.`,
    link: `/dashboard/projects/${projectId}#quote`,
    projectId,
  });

  return quote;
}
