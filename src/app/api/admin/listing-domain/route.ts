import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  claimCustomDomain,
  checkCustomDomainStatus,
  loadBusinessDomainState,
  removeCustomDomain,
  toPublicDomainState,
  emptyPublicDomainState,
  EntitlementError,
  ListingDomainSetupRequiredError,
} from "@/lib/custom-domain";
import { allowCustomDomainVerify } from "@/lib/custom-domain-rate-limit";
import { hasEntitlement } from "@/lib/entitlements";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { suggestListingDomain } from "@/lib/marketing/listing-url";

/**
 * Property Website Address (listings.yourstudio.com). Same Vercel registration, DNS
 * instructions, verification and status model as the client portal address
 * (/api/admin/custom-domain) — only the stored columns differ (kind = "listing").
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const entitled = await hasEntitlement(tenant.businessId, "custom_domain");
  try {
    const row = await loadBusinessDomainState(tenant.businessId, "listing");
    return NextResponse.json({
      entitled,
      setupRequired: false,
      suggestedDomain: suggestListingDomain(tenant.business.custom_domain),
      state: row
        ? toPublicDomainState(row)
        : emptyPublicDomainState(`${tenant.business.slug}.${getPlatformRootDomain()}`),
    });
  } catch (e) {
    if (e instanceof ListingDomainSetupRequiredError) {
      return NextResponse.json({
        entitled,
        setupRequired: true,
        suggestedDomain: suggestListingDomain(tenant.business.custom_domain),
        state: emptyPublicDomainState(`${tenant.business.slug}.${getPlatformRootDomain()}`),
      });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
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

  const base = {
    businessId: tenant.businessId,
    actorUserId: profile.id,
    actorEmail: profile.email ?? null,
    kind: "listing" as const,
  };

  try {
    if (body.action === "claim") {
      const state = await claimCustomDomain({ ...base, domainRaw: body.domain });
      return NextResponse.json({ state });
    }
    if (body.action === "check") {
      if (!allowCustomDomainVerify(`${tenant.businessId}:listing`)) {
        return NextResponse.json(
          { error: "You're checking status too often. Wait a few minutes — DNS updates are slow, not broken." },
          { status: 429 }
        );
      }
      const state = await checkCustomDomainStatus(base);
      return NextResponse.json({ state });
    }
    if (body.action === "remove") {
      const state = await removeCustomDomain(base);
      return NextResponse.json({ state });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof ListingDomainSetupRequiredError) {
      return NextResponse.json({ error: e.message, setupRequired: true }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
