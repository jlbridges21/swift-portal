import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  ADMIN_SEARCH_MIN_CHARS,
  runAdminSearch,
  sanitizeSearchQuery,
} from "@/lib/admin-search";
import { allowAdminSearch } from "@/lib/admin-search-rate-limit";

/**
 * Admin-only global search. Tenant is always taken from the session —
 * a `business_id` query/body param is rejected (cross-tenant leak vector).
 */
export async function GET(request: Request) {
  try {
    const profile = await requireAdmin();
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

    const db = await createTenantServiceClient(tenant.businessId);
    const started = Date.now();
    const results = await runAdminSearch(db, q);
    const elapsedMs = Date.now() - started;

    return NextResponse.json({
      q,
      results,
      elapsedMs,
      seeAll: {
        clients: `/admin/clients`,
        projects: `/admin/projects`,
        leads: `/admin/leads`,
        media: `/admin/media?q=${encodeURIComponent(q)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
