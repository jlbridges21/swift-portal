import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  claimCustomDomain,
  checkCustomDomainStatus,
  loadBusinessDomainState,
  removeCustomDomain,
  toPublicDomainState,
} from "@/lib/custom-domain";
import { allowCustomDomainVerify } from "@/lib/custom-domain-rate-limit";
import { getPlatformRootDomain } from "@/lib/site-metadata";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const row = await loadBusinessDomainState(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    state: toPublicDomainState(row),
    fallbackSubdomain: `${row.slug}.${getPlatformRootDomain()}`,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  let body: { action?: string; domain?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "claim") {
      const state = await claimCustomDomain({
        businessId: id,
        domainRaw: body.domain,
        actorUserId: auth.profile.id,
        actorEmail: auth.profile.email ?? null,
        skipEntitlement: true,
      });
      return NextResponse.json({ state });
    }
    if (body.action === "check") {
      if (!allowCustomDomainVerify(id)) {
        return NextResponse.json({ error: "Rate limited" }, { status: 429 });
      }
      const state = await checkCustomDomainStatus({
        businessId: id,
        actorUserId: auth.profile.id,
        actorEmail: auth.profile.email ?? null,
        skipEntitlement: true,
      });
      return NextResponse.json({ state });
    }
    if (body.action === "remove") {
      const state = await removeCustomDomain({
        businessId: id,
        actorUserId: auth.profile.id,
        actorEmail: auth.profile.email ?? null,
        skipEntitlement: true,
      });
      return NextResponse.json({ state });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
