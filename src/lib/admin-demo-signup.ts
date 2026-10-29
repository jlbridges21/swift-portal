/**
 * Super-admin demo signup: create customer accounts during live demos WITHOUT the browser's
 * partner referral cookie (sp_partner_ref) being applied.
 *
 * Trust model — the ?source=admin-demo URL grants nothing on its own:
 * - A super admin starts a demo from the platform console (POST /api/platform/demo-signup).
 *   The server sets SP_ADMIN_DEMO_COOKIE: httpOnly, HMAC-signed, bound to the super admin's
 *   user id, 4-hour expiry. Public visitors cannot mint or forge it.
 * - Or the request itself carries a signed-in super_admin session.
 * Either way the user id is re-checked against profiles.role = super_admin on every use, so a
 * demoted admin's leftover cookie stops working immediately.
 *
 * The bypass only skips partner attribution for that one signup. It never deletes or edits
 * referral records, never changes trial / paid signup options, and does not touch the 90-day
 * referral cookie for anyone else.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const ADMIN_DEMO_COOKIE = "sp_admin_demo";
export const ADMIN_DEMO_TTL_SECONDS = 4 * 60 * 60;
/** /signup?source=admin-demo — also the signup-intent source that carries the choice through OAuth. */
export const ADMIN_DEMO_SOURCE = "admin-demo";

type DemoClaims = { purpose: "admin_demo"; uid: string; exp: number };

export type AdminDemoAuthorization =
  | { ok: true; actorId: string; actorEmail: string | null; via: "demo_cookie" | "session" }
  | { ok: false };

function signingSecret(): string | null {
  return process.env.PLATFORM_SESSION_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signAdminDemoCookie(userId: string, now = Date.now()): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const claims: DemoClaims = {
    purpose: "admin_demo",
    uid: userId,
    exp: Math.floor(now / 1000) + ADMIN_DEMO_TTL_SECONDS,
  };
  const payload = `ad1.${Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")}`;
  return `${payload}.${hmacHex(secret, payload)}`;
}

/** Tampered / expired / wrong-purpose / unsigned ⇒ null. */
export function verifyAdminDemoCookie(raw: string | null | undefined, now = Date.now()): { uid: string } | null {
  const secret = signingSecret();
  const value = raw?.trim() ?? "";
  if (!secret || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "ad1") return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(hmacHex(secret, payload), "utf8");
  const given = Buffer.from(parts[2] ?? "", "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Partial<DemoClaims>;
    if (claims.purpose !== "admin_demo" || typeof claims.uid !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return null;
    return { uid: claims.uid };
  } catch {
    return null;
  }
}

export function adminDemoCookieOptions(maxAge = ADMIN_DEMO_TTL_SECONDS) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

async function superAdminEmail(userId: string): Promise<{ ok: boolean; email: string | null }> {
  const raw = await createServiceClient();
  const { data } = await raw.from("profiles").select("role, email").eq("id", userId).maybeSingle();
  return { ok: data?.role === "super_admin", email: (data?.email as string | null) ?? null };
}

/**
 * Is this request allowed to skip partner attribution? Server-side only.
 * Checks the signed demo cookie first (survives the browser signing in as the new customer),
 * then the current session.
 */
export async function resolveAdminDemoAuthorization(): Promise<AdminDemoAuthorization> {
  try {
    const jar = await cookies();
    const claims = verifyAdminDemoCookie(jar.get(ADMIN_DEMO_COOKIE)?.value);
    if (claims) {
      const check = await superAdminEmail(claims.uid);
      if (check.ok) return { ok: true, actorId: claims.uid, actorEmail: check.email, via: "demo_cookie" };
    }
  } catch {
    /* no cookie store */
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const check = await superAdminEmail(user.id);
      if (check.ok) return { ok: true, actorId: user.id, actorEmail: check.email ?? user.email ?? null, via: "session" };
    }
  } catch {
    /* signed out */
  }
  return { ok: false };
}
