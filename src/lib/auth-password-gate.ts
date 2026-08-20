/** Cookie set when invite/recovery/temp-password session must set a password first. */
export const NEEDS_PASSWORD_COOKIE = "sp_needs_password";

export function needsPasswordCookieOptions(clear = false) {
  return {
    path: "/",
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: clear ? 0 : 60 * 60 * 2,
  };
}
