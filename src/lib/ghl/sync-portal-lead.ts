import { createServiceClient } from "@/lib/supabase/server";
import type { GhlPortalLeadPayload, GhlSyncAttemptResult, GhlSyncStatus } from "./types";

const MAX_RESPONSE_BODY_LENGTH = 4000;

function truncateResponseBody(body: string | null): string | null {
  if (!body) return null;
  if (body.length <= MAX_RESPONSE_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_RESPONSE_BODY_LENGTH)}…`;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(/\/$/, "");
}

export function buildPortalUrls(options: { clientId: string; projectId: string }) {
  const base = appBaseUrl();
  return {
    portalClientUrl: `${base}/admin/clients/${options.clientId}`,
    portalProjectUrl: `${base}/admin/projects/${options.projectId}`,
  };
}

export async function syncPortalLeadToGhl(
  payload: GhlPortalLeadPayload
): Promise<GhlSyncAttemptResult> {
  const webhookUrl = process.env.GHL_PORTAL_LEAD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    console.warn("[ghl] webhook sync failed: GHL_PORTAL_LEAD_WEBHOOK_URL is not configured");
    return {
      ok: false,
      statusCode: null,
      responseBody: "GHL_PORTAL_LEAD_WEBHOOK_URL is not configured",
      error: "missing_webhook_url",
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
  result: GhlSyncAttemptResult
): Promise<void> {
  const supabase = await createServiceClient();
  const status: GhlSyncStatus = result.ok ? "success" : "failed";

  const { error } = await supabase
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
  payload: GhlPortalLeadPayload
): Promise<GhlSyncAttemptResult> {
  const result = await syncPortalLeadToGhl(payload);
  await updateProjectGhlSyncStatus(projectId, result);
  return result;
}
