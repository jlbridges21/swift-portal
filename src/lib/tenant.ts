import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Legacy production business — the only tenant until onboarding exists.
 * Every use of this constant is a TODO to be removed once the calling path
 * resolves a real business. Grep for it to find remaining work.
 */
export const LEGACY_DEFAULT_BUSINESS_ID =
  "00000000-0000-0000-0000-000000000001";

export const SA_BUSINESS_CONTEXT_COOKIE = "sa_business_context";

export interface TenantContext {
  businessId: string;
  business: {
    id: string;
    slug: string;
    name: string;
    status: string;
    custom_domain: string | null;
  };
  role: "super_admin" | "admin" | "client";
  isSuperAdmin: boolean;
  impersonating: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function loadBusiness(id: string): Promise<TenantContext["business"] | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, slug, name, status, custom_domain")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/**
 * Per-request tenant resolution.
 *
 * Verified against Next.js 16.2 bundled docs (`node_modules/next/dist/docs`):
 * - `React.cache` is request-scoped memoization. Fetching Data: "React.cache is
 *   scoped to the current request only. Each request gets its own memoization
 *   scope with no sharing between requests."
 * - Authentication DAL guide wraps session checks in `cache()` from `react`
 *   for Server Components.
 * - Glossary Memoization: non-fetch work should use React `cache`. Automatic
 *   `fetch` memoization does **not** apply in Route Handlers (they are not
 *   part of the RSC tree). `React.cache` still dedupes within a single request
 *   when Next's request ALS is active (App Router route handlers).
 * - `'use cache'` / `'use cache: private'` are cross-request or browser caches
 *   and must not hold tenant identity. This project does not enable
 *   `cacheComponents`.
 */
async function resolveTenantContext(): Promise<TenantContext | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const isSuperAdmin = profile.role === "super_admin";

  // Super_admin: cookie impersonation only. No cookie → no business (callers handle).
  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SA_BUSINESS_CONTEXT_COOKIE)?.value?.trim() ?? "";
    if (!raw || !isUuid(raw)) return null;
    const business = await loadBusiness(raw);
    if (!business) return null;
    return {
      businessId: business.id,
      business,
      role: "super_admin",
      isSuperAdmin: true,
      impersonating: true,
    };
  }

  // Match current_business_id() (v31b) plus the client_id hop the prompt requires:
  //   b) profiles.business_id
  //   c) clients.business_id via profiles.client_id (deleted_at IS NULL)
  //   d) clients.business_id via clients.user_id (deleted_at IS NULL)
  let businessId: string | null = profile.business_id ?? null;

  if (!businessId && profile.client_id) {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("clients")
      .select("business_id")
      .eq("id", profile.client_id)
      .is("deleted_at", null)
      .maybeSingle();
    businessId = data?.business_id ?? null;
  }

  if (!businessId) {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("clients")
      .select("business_id")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    businessId = data?.business_id ?? null;
  }

  if (!businessId) return null;

  const business = await loadBusiness(businessId);
  if (!business) return null;

  return {
    businessId: business.id,
    business,
    role: profile.role,
    isSuperAdmin: false,
    impersonating: false,
  };
}

export const getTenantContext: () => Promise<TenantContext | null> = cache(
  resolveTenantContext
);

/**
 * Fail-closed 400 for authenticated API routes with no resolvable tenant.
 * Super admins must impersonate; everyone else must have a business on the profile.
 */
export function missingTenantResponse(role: string) {
  const message =
    role === "super_admin"
      ? "No business context. Super admins must impersonate a business before reading or writing data."
      : "No business context on this account. Tenant context could not be resolved.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function requireTenantContext(): Promise<TenantContext> {
  const tenant = await getTenantContext();
  if (!tenant) {
    throw new Error("Unauthorized");
  }
  return tenant;
}

export async function requireBusinessAdmin(): Promise<TenantContext> {
  const tenant = await requireTenantContext();
  if (tenant.role !== "admin" && tenant.role !== "super_admin") {
    throw new Error("Forbidden");
  }
  return tenant;
}

export type PublicSignupBusinessResult =
  | { ok: true; businessId: string }
  | { ok: false; status: 400; error: string };

/**
 * Resolve the business for unauthenticated public intake (`/api/request`, `/api/leads`).
 * Optional `business_id` / `business_slug` must refer to an active, non-deleted business.
 * When both are absent, Swift is used so the existing public form keeps working.
 */
export async function resolvePublicSignupBusinessId(body: {
  business_id?: unknown;
  business_slug?: unknown;
}): Promise<PublicSignupBusinessResult> {
  const rawId = typeof body.business_id === "string" ? body.business_id.trim() : "";
  const rawSlug = typeof body.business_slug === "string" ? body.business_slug.trim() : "";

  if (!rawId && !rawSlug) {
    // TODO(tenant): resolve business from host — prompt 18
    return { ok: true, businessId: LEGACY_DEFAULT_BUSINESS_ID };
  }

  if (rawId && !isUuid(rawId)) {
    return { ok: false, status: 400, error: "Invalid or inactive business." };
  }

  const supabase = await createServiceClient();
  let query = supabase
    .from("businesses")
    .select("id, slug, status")
    .is("deleted_at", null);

  if (rawId) {
    query = query.eq("id", rawId);
  } else {
    query = query.eq("slug", rawSlug);
  }

  const { data } = await query.maybeSingle();
  if (!data || data.status !== "active") {
    return { ok: false, status: 400, error: "Invalid or inactive business." };
  }
  if (rawId && rawSlug && data.slug !== rawSlug) {
    return { ok: false, status: 400, error: "Invalid or inactive business." };
  }

  return { ok: true, businessId: data.id };
}
