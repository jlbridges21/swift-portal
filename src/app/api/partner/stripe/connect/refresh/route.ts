import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { PATH_TENANT_COOKIE, normalizeHostname } from "@/lib/host-resolution";
import {
  createPartnerConnectAccountLink,
  loadPartnerConnectByPartnerId,
  partnerConnectPathOnOrigin,
  resolvePartnerConnectCallbackOrigin,
  resolvePartnerConnectOrigin,
} from "@/lib/partner-stripe-connect";

export const runtime = "nodejs";

/** Stripe Account Link refresh_url — issue a fresh onboarding link. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const requestHeaders = request.headers;
  const hostname = normalizeHostname(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
  );
  const callbackOrigin = await resolvePartnerConnectCallbackOrigin({
    hostname,
    pathname: url.pathname,
    pathCookie: cookieStore.get(PATH_TENANT_COOKIE)?.value ?? null,
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  });

  const profile = await getProfile();
  if (!profile) {
    const login = partnerConnectPathOnOrigin(
      callbackOrigin,
      `/login?redirect=${encodeURIComponent("/partner/payout-details")}`
    );
    return NextResponse.redirect(login);
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") {
    return NextResponse.redirect(partnerConnectPathOnOrigin(callbackOrigin, "/partner"));
  }

  const snapshot = await loadPartnerConnectByPartnerId(access.partner.id);
  const accountId = snapshot?.stripeConnectAccountId;
  if (!accountId) {
    return NextResponse.redirect(partnerConnectPathOnOrigin(callbackOrigin, "/partner/payout-details"));
  }

  try {
    const { origin } = await resolvePartnerConnectOrigin({
      hostname,
      pathname: url.pathname,
      pathCookie: cookieStore.get(PATH_TENANT_COOKIE)?.value ?? null,
      profileBusinessId: profile.business_id ?? null,
      forwardedProto: requestHeaders.get("x-forwarded-proto"),
    });
    const linkUrl = await createPartnerConnectAccountLink(accountId, origin);
    return NextResponse.redirect(linkUrl);
  } catch (err) {
    console.error("[partner-stripe-connect] refresh link failed", {
      partnerId: access.partner.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      partnerConnectPathOnOrigin(callbackOrigin, "/partner/payout-details?stripe=error")
    );
  }
}
