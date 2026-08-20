import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { allowSignupAttempt } from "@/lib/signup-rate-limit";
import { resendTenantAdminAuthLink } from "@/lib/auth-resend-link";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Tenant-scoped "send me a new link" for expired invite/recovery hashes. */
export async function POST(request: Request) {
  const host = await getPublicHostContext();
  if (host.kind !== "tenant" || !host.businessId) {
    return NextResponse.json(
      { error: "Open this page on your studio’s portal (your subdomain) to request a new link." },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  if (!allowSignupAttempt(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await resendTenantAdminAuthLink({
    businessId: host.businessId,
    email,
  });
  return NextResponse.json(result);
}
