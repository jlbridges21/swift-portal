import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isEmailAnalyticsActivity } from "@/lib/communications";
import type { ActivityVisibility } from "@/lib/types";

interface ProjectContext {
  client_id: string | null;
  property_id: string | null;
}

async function loadProjectContext(
  projectId: string,
  businessId: string
): Promise<ProjectContext | null> {
  try {
    const db = await createTenantServiceClient(businessId);
    const { data } = await db
      .from("projects")
      .select("client_id, property_id")
      .eq("id", projectId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function logProjectActivity(
  activityType: string,
  description: string,
  options: {
    businessId: string;
    projectId?: string;
    leadId?: string;
    userId?: string | null;
    clientId?: string | null;
    propertyId?: string | null;
    title?: string | null;
    visibility?: ActivityVisibility;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const db = await createTenantServiceClient(options.businessId);

    let clientId = options.clientId ?? null;
    let propertyId = options.propertyId ?? null;

    if (options.projectId && (!clientId || !propertyId)) {
      const ctx = await loadProjectContext(options.projectId, options.businessId);
      clientId = clientId ?? ctx?.client_id ?? null;
      propertyId = propertyId ?? ctx?.property_id ?? null;
    }

    if (options.idempotencyKey) {
      let dupQuery = db
        .from("activity_logs")
        .select("id")
        .eq("idempotency_key", options.idempotencyKey);

      if (options.projectId) {
        dupQuery = dupQuery.eq("project_id", options.projectId);
      } else if (clientId) {
        dupQuery = dupQuery.eq("client_id", clientId);
      }

      const { data: existing } = await dupQuery.maybeSingle();
      if (existing?.id) return existing.id;
    }

    const visibility: ActivityVisibility =
      options.visibility ??
      (isEmailAnalyticsActivity(activityType) ? "admin" : "both");

    const { data: inserted, error } = await db
      .from("activity_logs")
      .insert({
        activity_type: activityType,
        description,
        title: options.title ?? null,
        user_id: options.userId ?? null,
        project_id: options.projectId ?? null,
        client_id: clientId,
        property_id: propertyId,
        lead_id: options.leadId ?? null,
        visibility,
        idempotency_key: options.idempotencyKey ?? null,
        metadata: options.metadata ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505" && options.idempotencyKey) {
        return null;
      }
      throw error;
    }

    if (clientId) {
      await db
        .from("clients")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", clientId);
    }

    return inserted?.id ?? null;
  } catch (err) {
    console.error("Failed to log activity:", err);
    return null;
  }
}

/** Log only when the idempotency key has not been used for this project. */
export async function logProjectActivityOnce(
  activityType: string,
  description: string,
  idempotencyKey: string,
  options: Parameters<typeof logProjectActivity>[2]
) {
  return logProjectActivity(activityType, description, {
    ...options,
    idempotencyKey,
  });
}
