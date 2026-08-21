import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  claimCustomDomain,
  checkCustomDomainStatus,
  loadBusinessDomainState,
  removeCustomDomain,
  toPublicDomainState,
  EntitlementError,
} from "@/lib/custom-domain";
import { allowCustomDomainVerify } from "@/lib/custom-domain-rate-limit";
import { hasEntitlement } from "@/lib/entitlements";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { isVercelDomainApiConfigured } from "@/lib/vercel-domains";

export async function GET() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const entitled = await hasEntitlement(tenant.businessId, "custom_domain");
  const row = await loadBusinessDomainState(tenant.businessId);
  const emptyState = {
    domain: null as string | null,
    status: null,
    vercelVerified: false,
    misconfigured: null as boolean | null,
    lastCheckedAt: null as string | null,
    error: null as string | null,
    dnsRecords: [] as [],
    verification: [] as [],
    portalUrl: null as string | null,
    vercelApiConfigured: isVercelDomainApiConfigured(),
    isApex: false,
    fallbackSubdomain: `${tenant.business.slug}.${getPlatformRootDomain()}`,
  };

  return NextResponse.json({
    entitled,
    state: row ? toPublicDomainState(row) : emptyState,
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  let body: { action?: string; domain?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  try {
    if (action === "claim") {
      const state = await claimCustomDomain({
        businessId: tenant.businessId,
        domainRaw: body.domain,
        actorUserId: profile.id,
        actorEmail: profile.email ?? null,
      });
      return NextResponse.json({ state });
    }

    if (action === "check") {
      if (!allowCustomDomainVerify(tenant.businessId)) {
        return NextResponse.json(
          {
            error:
              "You're checking status too often. Wait a few minutes — DNS updates are slow, not broken.",
          },
          { status: 429 }
        );
      }
      const state = await checkCustomDomainStatus({
        businessId: tenant.businessId,
        actorUserId: profile.id,
        actorEmail: profile.email ?? null,
      });
      return NextResponse.json({ state });
    }

    if (action === "remove") {
      const state = await removeCustomDomain({
        businessId: tenant.businessId,
        actorUserId: profile.id,
        actorEmail: profile.email ?? null,
      });
      return NextResponse.json({ state });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
