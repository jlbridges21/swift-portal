import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import {
  exchangeGoogleCode,
  getGoogleUserEmail,
  saveGoogleCalendarConnection,
  listGoogleCalendars,
  setGoogleCalendarId,
  verifyGoogleOAuthState,
} from "@/lib/google-calendar";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin, getDeploymentOrigin } from "@/lib/portal-url";

function settingsUrl(tenantOrigin: string, query: string) {
  return `${tenantOrigin}/admin/settings?${query}`;
}

export async function GET(request: Request) {
  const fallbackOrigin = getDeploymentOrigin();
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Return the admin to this business's portal (not the registered OAuth host).
    const appUrl = getBusinessPortalOrigin(tenant.business);

    if (error) {
      return NextResponse.redirect(settingsUrl(appUrl, "gcal=error"));
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("gcal_oauth_state")?.value;
    if (!code || !state || state !== savedState) {
      return NextResponse.redirect(settingsUrl(appUrl, "gcal=invalid"));
    }

    const verified = verifyGoogleOAuthState(state);
    if (!verified.ok) {
      console.warn("[google-calendar] OAuth state rejected", { reason: verified.reason });
      return NextResponse.redirect(settingsUrl(appUrl, "gcal=invalid"));
    }
    if (verified.businessId !== tenant.businessId) {
      console.warn("[google-calendar] OAuth state business mismatch", {
        signed: verified.businessId,
        tenant: tenant.businessId,
      });
      return NextResponse.redirect(settingsUrl(appUrl, "gcal=invalid"));
    }

    const tokens = await exchangeGoogleCode(code);
    const email = await getGoogleUserEmail(tokens.access_token);

    await saveGoogleCalendarConnection({
      businessId: verified.businessId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresIn: tokens.expires_in,
      email,
      userId: profile.id,
    });

    const calendars = await listGoogleCalendars(verified.businessId);
    const primary = calendars.find((c) => c.primary) ?? calendars[0];
    if (primary) {
      await setGoogleCalendarId(verified.businessId, primary.id, primary.summary);
    }

    const response = NextResponse.redirect(settingsUrl(appUrl, "gcal=connected"));
    response.cookies.delete("gcal_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(settingsUrl(fallbackOrigin, "gcal=error"));
  }
}
