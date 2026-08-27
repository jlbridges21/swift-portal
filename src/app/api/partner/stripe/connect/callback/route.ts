import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { PATH_TENANT_COOKIE } from "@/lib/host-resolution";
import { normalizeHostname } from "@/lib/host-resolution";
import {
  applyPartnerStripeAccountSnapshot,
  loadPartnerConnectByPartnerId,
  partnerConnectPathOnOrigin,
  resolvePartnerConnectCallbackOrigin,
  retrievePartnerExpressAccount,
} from "@/lib/partner-stripe-connect";

export const runtime = "nodejs";

/** Stripe Account Link return_url — refresh status then send partner to payout details. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const requestHeaders = request.headers;
  const hostname = normalizeHostname(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
  );
  const origin = await resolvePartnerConnectCallbackOrigin({
    hostname,
    pathname: url.pathname,
    pathCookie: cookieStore.get(PATH_TENANT_COOKIE)?.value ?? null,
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  });
  const dest = partnerConnectPathOnOrigin(origin, "/partner/payout-details");

  const profile = await getProfile();
  if (!profile) {
    const login = partnerConnectPathOnOrigin(
      origin,
      `/login?redirect=${encodeURIComponent("/partner/payout-details")}`
    );
    return NextResponse.redirect(login);
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") {
    return NextResponse.redirect(partnerConnectPathOnOrigin(origin, "/partner"));
  }

  const snapshot = await loadPartnerConnectByPartnerId(access.partner.id);
  const accountId = snapshot?.stripeConnectAccountId;
  if (accountId) {
    try {
      const account = await retrievePartnerExpressAccount(accountId);
      await applyPartnerStripeAccountSnapshot(access.partner.id, account);
    } catch (err) {
      console.error("[partner-stripe-connect] callback refresh failed", {
        partnerId: access.partner.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.redirect(dest);
}
