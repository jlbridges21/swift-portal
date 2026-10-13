import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { buildPreliminaryEstimatePayload } from "@/lib/business-services";
import { getAppSettings, addProposalExpiration } from "@/lib/app-settings";
import { decidePreliminaryTravel } from "@/lib/preliminary-travel";
import type { ZipQuery } from "@/lib/zip-distance";
import { logWorkflowSkipped } from "@/lib/workflow";

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
  if (!serviceType?.trim()) {
    return null;
  }

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

  const { data: existing } = await db
    .from("project_quotes")
    .select("id")
    .eq("project_id", projectId)
    .eq("quote_kind", "preliminary")
    .maybeSingle();

  if (existing) {
    const payload = await buildPreliminaryEstimateWithTravel({
      projectId,
      serviceType,
      businessId,
      appSettings,
      db: db as unknown as TravelEstimateDb,
    });
    const expiresAt = addProposalExpiration(
      new Date(),
      appSettings.proposals.defaultEstimateExpirationDays
    );
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
        ...(payload.travelActive ? { travel_one_way_miles: payload.oneWayMiles } : {}),
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
  if (!serviceType?.trim()) {
    return null;
  }

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

  const payload = await buildPreliminaryEstimateWithTravel({
    projectId,
    serviceType,
    businessId,
    appSettings,
    db: db as unknown as TravelEstimateDb,
  });
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
      ...(payload.travelActive ? { travel_one_way_miles: payload.oneWayMiles } : {}),
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

type TravelEstimateDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: { property_address?: string | null } | null }>;
        };
      };
    };
  };
  raw: ZipQuery;
};

async function buildPreliminaryEstimateWithTravel(input: {
  projectId: string;
  serviceType: string;
  businessId: string;
  appSettings: Awaited<ReturnType<typeof getAppSettings>>;
  db: TravelEstimateDb;
}) {
  const { projectId, serviceType, businessId, appSettings, db } = input;
  const built = await buildPreliminaryEstimatePayload(
    serviceType,
    {
      portalName: appSettings.business.portalName,
      businessName: appSettings.business.businessName,
    },
    businessId
  );
  const { data: project } = await db
    .from("projects")
    .select("property_address")
    .eq("id", projectId)
    .eq("business_id", businessId)
    .maybeSingle();

  const decision = await decidePreliminaryTravel({
    settings: appSettings.travel,
    businessPostalCode: appSettings.business.postalCode,
    businessCountry: appSettings.business.country,
    propertyAddress: project?.property_address ?? null,
    hidePricing: built.hidePricing,
    db: db.raw,
  });

  if (decision.notifyReason) {
    await logWorkflowSkipped(projectId, decision.notifyReason);
    await notifyAdmins({
      businessId,
      projectId,
      type: "status_changed",
      title: "Travel fee was not added",
      body: decision.notifyReason,
      link: `/admin/projects/${projectId}#quote`,
    });
  }

  const lineItems = decision.lineItem
    ? [...built.line_items, decision.lineItem]
    : built.line_items;

  return {
    title: built.title,
    description: built.description,
    line_items: lineItems,
    total_cents: built.total_cents + (decision.lineItem?.amount_cents ?? 0),
    notes: built.notes,
    travelActive: decision.active,
    oneWayMiles: decision.oneWayMiles,
  };
}
