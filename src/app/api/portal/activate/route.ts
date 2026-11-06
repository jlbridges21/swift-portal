import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { activatePortalWithToken } from "@/lib/portal-activation-server";
import { allowPortalActivationAttempt, requestIp } from "@/lib/portal-activation-rate-limit";

/**
 * Public: a client sets their own portal password from an activation token
 * (thank-you page or emailed link). The token is the capability; it must
 * belong to the business that owns this host.
 */
export async function POST(request: Request) {
  if (!allowPortalActivationAttempt("activate", requestIp(request))) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    password?: unknown;
    confirm_password?: unknown;
  };
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Missing activation link." }, { status: 400 });

  const host = await getPublicHostContext();
  if (host.kind !== "tenant" || !host.businessId) {
    return NextResponse.json({ error: "Open this link from your portal address." }, { status: 400 });
  }

  try {
    const result = await activatePortalWithToken({
      token,
      password: body.password,
      confirmPassword: body.confirm_password,
      hostBusinessId: host.businessId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, reason: result.reason }, { status: result.status });
    }
    return NextResponse.json({ success: true, email: result.email, next: result.nextPath });
  } catch (err) {
    console.error("[portal/activate]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
