import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { parseAnalyticsRange, safeTimeZone } from "@/lib/dashboard-analytics";
import { loadDashboardAnalytics } from "@/lib/dashboard-analytics-server";

export const dynamic = "force-dynamic";

/**
 * Command Center analytics for the signed-in business owner.
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (business-local days; defaults to the last 30 days).
 *
 * Owner admins only (staff are refused, same as the /admin dashboard). The tenant always
 * comes from the session; a business_id parameter is rejected.
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

  const settings = await getAppSettings(tenant.businessId);
  const timeZone = safeTimeZone(settings.workflow.businessDefaults.timezone);
  const parsed = parseAnalyticsRange(url.searchParams.get("from"), url.searchParams.get("to"), timeZone);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const data = await loadDashboardAnalytics(tenant.businessId, parsed.range, timeZone);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[api/admin/dashboard/analytics]", err);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
