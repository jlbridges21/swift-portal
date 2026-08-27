import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { PATH_TENANT_COOKIE, normalizeHostname } from "@/lib/host-resolution";
import {
  createPartnerConnectAccountLink,
  createPartnerExpressAccount,
  getLivePartnerConnectStatus,
  loadPartnerConnectByPartnerId,
  resolvePartnerConnectOrigin,
  upsertPendingPartnerConnectAccount,
} from "@/lib/partner-stripe-connect";

export const runtime = "nodejs";

/**
 * FLOW C — Partner Express Connect status / start onboarding.
 * Never reads business_integrations.stripe_account_id.
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  const live = await getLivePartnerConnectStatus(access.partner.id);
  return NextResponse.json(live);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  try {
    let snapshot = await loadPartnerConnectByPartnerId(access.partner.id);
    let accountId = snapshot?.stripeConnectAccountId ?? null;

    if (!accountId) {
      const account = await createPartnerExpressAccount(access.partner);
      accountId = account.id;
      await upsertPendingPartnerConnectAccount(access.partner.id, accountId);
    }

    const url = new URL(request.url);
    const cookieStore = await cookies();
    const requestHeaders = request.headers;
    const hostname = normalizeHostname(
      requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
    );
    const { origin, rejectedHostname } = await resolvePartnerConnectOrigin({
      hostname,
      pathname: url.pathname,
      pathCookie: cookieStore.get(PATH_TENANT_COOKIE)?.value ?? null,
      profileBusinessId: profile.business_id ?? null,
      forwardedProto: requestHeaders.get("x-forwarded-proto"),
    });
    if (rejectedHostname) {
      console.warn("[partner-stripe-connect] POST used apex after rejecting host", {
        rejectedHostname,
        partnerId: access.partner.id,
        origin,
      });
    }

    const linkUrl = await createPartnerConnectAccountLink(accountId, origin);
    return NextResponse.json({ url: linkUrl, returnOrigin: origin });
  } catch (err) {
    console.error("[partner-stripe-connect] failed to start onboarding", {
      partnerId: access.partner.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Could not start Stripe payout onboarding." }, { status: 500 });
  }
}
