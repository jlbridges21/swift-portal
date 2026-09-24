import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  ADMIN_SEARCH_MIN_CHARS,
  runAdminSearch,
  sanitizeSearchQuery,
  type AdminSearchScope,
} from "@/lib/admin-search";
import { allowAdminSearch } from "@/lib/admin-search-rate-limit";
import {
  isOwnerAdmin,
  staffCan,
  staffCanAccessArea,
  visibleProjectIdsFor,
} from "@/lib/staff-access";

/**
 * Admin-only global search. Tenant is always taken from the session —
 * a `business_id` query/body param is rejected (cross-tenant leak vector).
 * Results are scoped to the viewer's staff permissions + assigned projects.
 */
export async function GET(request: Request) {
  try {
    const profile = await requireAdmin({ anyArea: true });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const url = new URL(request.url);
    if (url.searchParams.has("business_id") || url.searchParams.has("businessId")) {
      return NextResponse.json(
        { error: "business_id is not accepted; search is scoped to your session tenant." },
        { status: 400 }
      );
    }

    const q = sanitizeSearchQuery(url.searchParams.get("q") ?? "");
    if (q.length < ADMIN_SEARCH_MIN_CHARS) {
      return NextResponse.json(
        { error: `Query must be at least ${ADMIN_SEARCH_MIN_CHARS} characters.`, results: null },
        { status: 400 }
      );
    }

    if (!allowAdminSearch(tenant.businessId, profile.id)) {
      return NextResponse.json({ error: "Too many searches. Try again shortly." }, { status: 429 });
    }

    const owner = isOwnerAdmin(profile);
    const visibleProjectIds = owner
      ? ("all" as const)
      : await visibleProjectIdsFor(tenant.businessId, profile);

    const scope: AdminSearchScope = {
      isOwnerAdmin: owner,
      visibleProjectIds,
      areas: {
        clients: owner || staffCanAccessArea(profile, "clients"),
        projects: owner || staffCanAccessArea(profile, "projects"),
        media: owner || staffCanAccessArea(profile, "media"),
        leads: owner,
      },
      canSearchStaff: owner,
      moneyView: owner || staffCan(profile, "money.view"),
    };

    const db = await createTenantServiceClient(tenant.businessId);
    const started = Date.now();
    const results = await runAdminSearch(db, q, scope);
    const elapsedMs = Date.now() - started;

    return NextResponse.json({
      q,
      results,
      elapsedMs,
      seeAll: {
        clients: scope.areas.clients ? `/admin/clients` : undefined,
        projects: scope.areas.projects ? `/admin/projects` : undefined,
        leads: scope.areas.leads ? `/admin/leads` : undefined,
        media: scope.areas.media
          ? `/admin/media?q=${encodeURIComponent(q)}`
          : undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
