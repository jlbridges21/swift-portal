import { NextResponse } from "next/server";
import { NEEDS_PASSWORD_COOKIE, needsPasswordCookieOptions } from "@/lib/auth-password-gate";

/** Sets the password-setup gate after an implicit-flow recovery/invite session. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(NEEDS_PASSWORD_COOKIE, "1", needsPasswordCookieOptions());
  return response;
}
