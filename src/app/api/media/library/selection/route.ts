import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  countLibraryKinds,
  parseLibraryFilters,
  queryMediaLibraryAll,
} from "@/lib/media-library";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin, visibleProjectIdsFor } from "@/lib/staff-access";

/**
 * Resolve a "Select all matching" scope to concrete asset ids.
 *
 * Body: `{ query: "<library query string>", exclude: ["kind:id", ...] }`.
 * The query string uses the same params as GET /api/media/library, so the
 * resolved set is exactly what the grid would page through. Bulk actions then
 * run against these ids only — never against a re-evaluated filter.
 */
export async function POST(request: Request) {
  try {
    const profile = await requireAdmin({ area: "media" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const body = (await request.json().catch(() => null)) as
      | { query?: unknown; exclude?: unknown }
      | null;
    const query = typeof body?.query === "string" ? body.query : "";
    const exclude = new Set(
      Array.isArray(body?.exclude)
        ? body.exclude.filter((v): v is string => typeof v === "string")
        : []
    );

    const projectIds = isOwnerAdmin(profile)
      ? ("all" as const)
      : await visibleProjectIdsFor(tenant.businessId, profile);

    const all = await queryMediaLibraryAll(tenant.businessId, {
      ...parseLibraryFilters(new URLSearchParams(query)),
      projectIds,
    });

    const items = all
      .filter((a) => !exclude.has(`${a.kind}:${a.id}`))
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        has_file: a.has_file,
        file_size: a.file_size,
      }));

    return NextResponse.json({
      items,
      total: items.length,
      kindCounts: countLibraryKinds(items),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
