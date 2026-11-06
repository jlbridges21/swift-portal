import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { resendActivationFromToken } from "@/lib/portal-activation-server";
import { openActivationToken } from "@/lib/portal-activation";
import { allowPortalActivationAttempt, requestIp } from "@/lib/portal-activation-rate-limit";

/**
 * Public: "Email me a new link" for an expired/used activation link or the
 * thank-you page. Always sends to the client's email on file — never to an
 * address supplied by the caller.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const opened = openActivationToken(token);
  if (!opened.ok) return NextResponse.json({ error: "This link isn't valid." }, { status: 400 });

  if (
    !allowPortalActivationAttempt("resend", `ip:${requestIp(request)}`) ||
    !allowPortalActivationAttempt("resend", `client:${opened.payload.c}`)
  ) {
    return NextResponse.json(
      { error: "We just sent a link. Please check your inbox, or try again in a few minutes." },
      { status: 429 }
    );
  }

  const host = await getPublicHostContext();
  if (host.kind !== "tenant" || !host.businessId) {
    return NextResponse.json({ error: "Open this link from your portal address." }, { status: 400 });
  }

  try {
    const result = await resendActivationFromToken(token, host.businessId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, reason: result.reason }, { status: result.status });
    }
    return NextResponse.json({ success: true, sentTo: result.maskedEmail });
  } catch (err) {
    console.error("[portal/activation/resend]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
