import { NextResponse } from "next/server";
import { NEEDS_PASSWORD_COOKIE, needsPasswordCookieOptions } from "@/lib/auth-password-gate";

/** Clears the password-setup gate after updateUser({ password }) succeeds. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(NEEDS_PASSWORD_COOKIE, "", needsPasswordCookieOptions(true));
  return response;
}
