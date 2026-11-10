import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isUuid } from "@/lib/marketing/model";
import {
  loadKitContext,
  MarketingError,
  MarketingSetupRequiredError,
  resolveMarketingActor,
  visibleToClient,
  type KitContext,
  type MarketingActor,
} from "@/lib/marketing/server";

export type MarketingRouteOk = { ok: true; actor: MarketingActor; businessId: string; ctx: KitContext };
export type MarketingRouteFail = { ok: false; response: Response };

/** Auth + project access + kit load for /api/marketing/{projectId}/… routes. 404s never confirm existence. */
export async function requireMarketingRoute(projectId: string, opts?: { loadContext?: boolean }): Promise<MarketingRouteOk | MarketingRouteFail> {
  if (!isUuid(projectId)) return { ok: false, response: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  const profile = await getProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false, response: missingTenantResponse(profile.role) };
  const actor = await resolveMarketingActor(profile, projectId, tenant.businessId);
  if (!actor) return { ok: false, response: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  try {
    const ctx = await loadKitContext(tenant.businessId, projectId);
    if (!ctx) return { ok: false, response: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    if (actor.kind === "client" && !visibleToClient(ctx)) {
      return { ok: false, response: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    }
    return { ok: true, actor, businessId: tenant.businessId, ctx };
  } catch (e) {
    return { ok: false, response: marketingErrorResponse(e) };
  }
}

export function marketingErrorResponse(e: unknown): Response {
  if (e instanceof MarketingSetupRequiredError) {
    return NextResponse.json({ error: e.message, setupRequired: true }, { status: 503 });
  }
  if (e instanceof MarketingError) return NextResponse.json({ error: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : "Request failed";
  if (/Impersonation is read-only/.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[marketing] route error", message);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
