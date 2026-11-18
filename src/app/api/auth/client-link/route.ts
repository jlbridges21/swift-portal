import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { allowPortalActivationAttempt, requestIp } from "@/lib/portal-activation-rate-limit";
import { requestClientSignInLink, sendFreshClientAccessLink } from "@/lib/client-access-link-server";
import { clientAccessRefusalMessage } from "@/lib/client-access-link";

export const dynamic = "force-dynamic";

/**
 * Public: email a one-click project link to a client of this portal.
 * - { action: "resend", token } — expired/stale link → fresh link to the address on file.
 * - { action: "request", email } — login page "Email me a sign-in link". Always 200 with
 *   the same message, whether or not the address is a client here.
 */
export async function POST(request: Request) {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) {
    return NextResponse.json({ error: "Open this page from your portal address." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; token?: unknown; email?: unknown };
  const ip = requestIp(request);

  if (body.action === "resend") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return NextResponse.json({ error: "Missing link." }, { status: 400 });
    if (!allowPortalActivationAttempt("resend", `client-link:${ip}`)) {
      return NextResponse.json({ error: clientAccessRefusalMessage("rate_limited") }, { status: 429 });
    }
    const result = await sendFreshClientAccessLink(token, host.businessId);
    if (!result.ok) {
      const error =
        result.reason === "send_failed"
          ? "We couldn't send the email just now. Please try again or contact the business."
          : clientAccessRefusalMessage(result.reason);
      return NextResponse.json({ error }, { status: result.reason === "send_failed" ? 502 : 403 });
    }
    return NextResponse.json({ ok: true, maskedEmail: result.maskedEmail });
  }

  if (body.action === "request") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter the email address the business has on file." }, { status: 400 });
    }
    if (
      !allowPortalActivationAttempt("resend", `client-link-request:${ip}`) ||
      !allowPortalActivationAttempt("resend", `client-link-request:${email.toLowerCase()}`)
    ) {
      return NextResponse.json({ error: clientAccessRefusalMessage("rate_limited") }, { status: 429 });
    }
    await requestClientSignInLink({ businessId: host.businessId, email });
    return NextResponse.json({
      ok: true,
      message: "If that email is on file with us, a sign-in link is on its way. It opens your project with no password.",
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
