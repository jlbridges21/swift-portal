import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { notifyProjectClients } from "@/lib/notifications";
import { buildPreliminaryEstimatePayload } from "@/lib/service-templates";
import { getAppSettings, addProposalExpiration } from "@/lib/app-settings";

export async function createPreliminaryEstimate(
  projectId: string,
  serviceType: string,
  options?: { userId?: string | null; skipIfExists?: boolean }
) {
  const appSettings = await getAppSettings();
  if (!appSettings.proposals.autoPreliminaryEstimate) {
    return null;
  }

  const supabase = await createServiceClient();

  if (options?.skipIfExists) {
    const { data: existing } = await supabase
      .from("project_quotes")
      .select("id")
      .eq("project_id", projectId)
      .eq("quote_kind", "preliminary")
      .maybeSingle();
    if (existing) return existing;
  }

  const payload = buildPreliminaryEstimatePayload(serviceType);
  const expiresAt = addProposalExpiration(
    new Date(),
    appSettings.proposals.defaultEstimateExpirationDays
  );

  const { data: quote, error } = await supabase
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
      projectId,
      userId: options?.userId ?? null,
      metadata: { quoteId: quote.id, serviceType },
    }
  );

  await notifyProjectClients({
    type: "status_changed",
    eventKey: "preliminary_estimate_created",
    title: "Your preliminary estimate is ready",
    body: "Your automatically generated preliminary estimate is ready to review in Swift Portal.",
    link: `/dashboard/projects/${projectId}#quote`,
    projectId,
  });

  return quote;
}
