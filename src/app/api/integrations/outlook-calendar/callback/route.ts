import { NextResponse } from "next/server";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { resolveGoogleCalendarReturnUrl } from "@/lib/google-calendar";
import {
  completeOutlookCalendarConnect,
  isOutlookCalendarCallbackHost,
  verifyOutlookOAuthState,
} from "@/lib/outlook-calendar";

/** Microsoft redirects here (platform apex) — then the browser goes back to the business portal. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host).split(",")[0].trim();
  if (!isOutlookCalendarCallbackHost(host)) {
    return NextResponse.json({ error: "Outlook Calendar callback is only accepted on shootportal.app." }, { status: 400 });
  }

  const state = verifyOutlookOAuthState(url.searchParams.get("state") || "");
  const portalOrigin = state ? await getBusinessPortalOriginById(state.businessId) : "https://www.shootportal.app";
  // The same signed-return helper Google Calendar uses (pure function: picks the portal origin).
  const back = (path: string) =>
    NextResponse.redirect(
      resolveGoogleCalendarReturnUrl({ returnOrigin: state?.returnOrigin || portalOrigin, businessPortalOrigin: portalOrigin, path })
    );
  // Connect started from the Shoot Calendar → land back there; otherwise Settings → Integrations.
  const landing = (query: string) =>
    state?.returnPath ? `${state.returnPath}?${query}` : `/admin/settings?${query}#settings-integrations`;
  const fail = (reason: string) => back(landing(`ocal=error&reason=${encodeURIComponent(reason)}`));

  if (!state) return fail("invalid_state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    // Work/school accounts whose organization blocks user consent come back with this.
    const description = url.searchParams.get("error_description") || "";
    const reason = /AADSTS65001|AADSTS90094|admin/i.test(description) ? "admin_consent_required" : oauthError;
    return fail(reason);
  }
  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");

  try {
    await completeOutlookCalendarConnect({ businessId: state.businessId, userId: state.userId, code });
  } catch (err) {
    console.error("[outlook-calendar] connect failed", { businessId: state.businessId, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
    return fail("exchange_failed");
  }
  return back(landing("ocal=connected"));
}
