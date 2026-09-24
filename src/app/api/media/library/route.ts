import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLibraryFilterOptions, queryMediaLibrary } from "@/lib/media-library";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin, visibleClientIdsFor, visibleProjectIdsFor } from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const profile = await requireAdmin({ area: "media" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { searchParams } = new URL(request.url);
    const projectIds = isOwnerAdmin(profile)
      ? ("all" as const)
      : await visibleProjectIdsFor(tenant.businessId, profile);

    const result = await queryMediaLibrary(tenant.businessId, {
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      service: searchParams.get("service") ?? undefined,
      propertyType: searchParams.get("property_type") ?? undefined,
      projectStatus: searchParams.get("project_status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      datePreset: searchParams.get("date") ?? undefined,
      dateFrom: searchParams.get("date_from") ?? undefined,
      dateTo: searchParams.get("date_to") ?? undefined,
      clientId: searchParams.get("client_id") ?? undefined,
      propertyId: searchParams.get("property_id") ?? undefined,
      favoritesOnly: searchParams.get("favorites") === "1",
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 48),
      projectIds,
    });

    if (searchParams.get("options") === "1") {
      const clientIds = isOwnerAdmin(profile)
        ? ("all" as const)
        : await visibleClientIdsFor(tenant.businessId, profile);
      const options = await getLibraryFilterOptions(tenant.businessId, {
        projectIds,
        clientIds,
      });
      return NextResponse.json({ ...result, filterOptions: options });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
