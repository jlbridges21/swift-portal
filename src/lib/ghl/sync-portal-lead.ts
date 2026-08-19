import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { LEGACY_DEFAULT_BUSINESS_ID as SWIFT_AERIAL_MEDIA_ID } from "@/lib/tenant";
import type { GhlPortalLeadPayload, GhlSyncAttemptResult, GhlSyncStatus } from "./types";

const MAX_RESPONSE_BODY_LENGTH = 4000;

function truncateResponseBody(body: string | null): string | null {
  if (!body) return null;
  if (body.length <= MAX_RESPONSE_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_RESPONSE_BODY_LENGTH)}…`;
}

export async function buildPortalUrls(options: {
  clientId: string;
  projectId: string;
  businessId: string;
}) {
  const base = await getBusinessPortalOriginById(options.businessId);
  return {
    portalClientUrl: `${base}/admin/clients/${options.clientId}`,
    portalProjectUrl: `${base}/admin/projects/${options.projectId}`,
  };
}

function resolveGhlWebhookUrl(businessId: string, webhookFromSettings: string): string {
  const fromSettings = webhookFromSettings.trim();
  if (fromSettings) return fromSettings;
  if (businessId === SWIFT_AERIAL_MEDIA_ID) {
    return process.env.GHL_PORTAL_LEAD_WEBHOOK_URL?.trim() ?? "";
  }
  return "";
}

export async function syncPortalLeadToGhl(
  payload: GhlPortalLeadPayload,
  businessId: string
): Promise<GhlSyncAttemptResult> {
  const settings = await getAppSettings(businessId);
  const webhookUrl = resolveGhlWebhookUrl(businessId, settings.integrations.ghlWebhookUrl);

  if (!webhookUrl) {
    return {
      ok: true,
      skipped: true,
      statusCode: null,
      responseBody: null,
    };
  }

  console.info("[ghl] webhook sync started", {
    projectUrl: payload.portalProjectUrl,
    service: payload.serviceRequested,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseBody = truncateResponseBody(await response.text());

    if (!response.ok) {
      console.error("[ghl] webhook sync failed", {
        statusCode: response.status,
        responseBody,
      });
      return {
        ok: false,
        statusCode: response.status,
        responseBody,
        error: `HTTP ${response.status}`,
      };
    }

    console.info("[ghl] webhook sync succeeded", {
      statusCode: response.status,
    });

    return {
      ok: true,
      statusCode: response.status,
      responseBody,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ghl] webhook sync failed", { error: message });
    return {
      ok: false,
      statusCode: null,
      responseBody: message,
      error: message,
    };
  }
}

export async function updateProjectGhlSyncStatus(
  projectId: string,
  result: GhlSyncAttemptResult,
  businessId: string
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const status: GhlSyncStatus = result.ok ? "success" : "failed";

  const { error } = await db
    .from("projects")
    .update({
      ghl_sync_status: status,
      ghl_last_sync_attempt_at: new Date().toISOString(),
      ghl_webhook_status_code: result.statusCode,
      ghl_webhook_response_body: result.responseBody,
    })
    .eq("id", projectId);

  if (error) {
    console.error("[ghl] failed to update project sync status", {
      projectId,
      error: error.message,
    });
  }
}

/** Post lead to GHL and persist sync status on the project. Never throws. */
export async function syncNewProjectLeadToGhl(
  projectId: string,
  payload: GhlPortalLeadPayload,
  businessId: string
): Promise<GhlSyncAttemptResult> {
  const result = await syncPortalLeadToGhl(payload, businessId);
  if (result.skipped) return result;
  await updateProjectGhlSyncStatus(projectId, result, businessId);
  return result;
}
