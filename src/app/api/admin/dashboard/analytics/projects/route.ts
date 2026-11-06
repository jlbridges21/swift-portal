import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { parseAnalyticsRange, parseServiceKeysParam, safeTimeZone } from "@/lib/dashboard-analytics";
import { loadDashboardDrilldown } from "@/lib/dashboard-analytics-server";

export const dynamic = "force-dynamic";

/**
 * Command Center drill-down: the projects behind one chart period or one service slice.
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&service=<key>&service=<key>…]
 *
 * Owner admins only, tenant from the session; a business_id parameter is rejected.
 */
export async function GET(request: Request) {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const url = new URL(request.url);
  if (url.searchParams.has("business_id") || url.searchParams.has("businessId")) {
    return NextResponse.json(
      { error: "business_id is not accepted; analytics are scoped to your session business." },
      { status: 400 }
    );
  }

  const serviceKeys = parseServiceKeysParam(url.searchParams.getAll("service"));
  if (serviceKeys === "invalid") return NextResponse.json({ error: "Invalid service." }, { status: 400 });

  const settings = await getAppSettings(tenant.businessId);
  const timeZone = safeTimeZone(settings.workflow.businessDefaults.timezone);
  const parsed = parseAnalyticsRange(url.searchParams.get("from"), url.searchParams.get("to"), timeZone);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const data = await loadDashboardDrilldown(tenant.businessId, parsed.range, timeZone, serviceKeys);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[api/admin/dashboard/analytics/projects]", err);
    return NextResponse.json({ error: "Could not load projects." }, { status: 500 });
  }
}
