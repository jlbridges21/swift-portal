import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  isEmailOtpType,
  needsPasswordForOtpType,
  passwordSetupReason,
  safeAuthNext,
} from "@/lib/auth-confirm";
import {
  NEEDS_PASSWORD_COOKIE,
  needsPasswordCookieOptions,
} from "@/lib/auth-password-gate";
import { resolveCrossOriginRedirect } from "@/lib/auth-session-handoff";
import {
  assertAllowedAuthReturnOrigin,
  canonicalAuthHostsMatch,
  resolvePostConfirmReturnOrigin,
} from "@/lib/auth-return-to";
import { joinPortalPath } from "@/lib/portal-url";

/**
 * POST only — human Continue button (or auto-submit). Sole verifyOtp call for
 * TokenHash email links. Session is established on the canonical host, then a
 * v68 auth_session_handoffs token sends the browser to the tenant origin.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") || "").trim();
  const typeRaw = String(form.get("type") || "").trim();
  const next = safeAuthNext(String(form.get("next") || "").trim() || null);
  const returnToRaw = String(form.get("return_to") || "").trim() || null;

  if (!tokenHash || !isEmailOtpType(typeRaw)) {
    return NextResponse.redirect(`${origin}/login?error=otp_expired`);
  }
  const type = typeRaw as EmailOtpType;

  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];
  let destPath = next || "/admin";
  const response = NextResponse.redirect(`${origin}${destPath}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get("cookie")
            ?.split("; ")
            .filter(Boolean)
            .map((c) => {
              const i = c.indexOf("=");
              return {
                name: i >= 0 ? c.slice(0, i) : c,
                value: i >= 0 ? decodeURIComponent(c.slice(i + 1)) : "",
              };
            }) ?? [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
            cookiesToCopy.push({ name, value, options });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("[auth/confirm/verify] verifyOtp failed", error.message);
    return NextResponse.redirect(`${origin}/login?error=otp_expired`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let businessId: string | null = null;
  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, business_id")
        .eq("id", user.id)
        .maybeSingle();
      businessId = profile?.business_id ?? null;

      if (needsPasswordForOtpType(type)) {
        const reason = passwordSetupReason(type);
        const params = new URLSearchParams({ reason });
        if (next) params.set("next", next);
        destPath = `/auth/update-password?${params.toString()}`;
        const opts = needsPasswordCookieOptions();
        response.cookies.set(NEEDS_PASSWORD_COOKIE, "1", opts);
        cookiesToCopy.push({ name: NEEDS_PASSWORD_COOKIE, value: "1", options: opts });
      } else if (next) {
        destPath = next;
      } else if (profile?.role === "super_admin") {
        destPath = "/platform";
      } else if (profile?.role === "admin") {
        const { adminHomePath } = await import("@/lib/onboarding");
        const { lookupBusinessById } = await import("@/lib/host-resolution");
        const biz = profile.business_id
          ? await lookupBusinessById(profile.business_id)
          : null;
        destPath = adminHomePath({
          onboardingCompletedAt: biz?.onboarding_completed_at,
          onboardingState: biz?.onboarding_state,
        });
      } else if (profile?.role === "client") {
        destPath = "/dashboard";
      } else {
        destPath = "/admin";
      }
    } catch (err) {
      console.error("[auth/confirm/verify] role resolve failed", err);
      if (needsPasswordForOtpType(type)) {
        const reason = passwordSetupReason(type);
        destPath = `/auth/update-password?reason=${reason}`;
      } else {
        destPath = "/admin";
      }
    }
  } else if (needsPasswordForOtpType(type)) {
    destPath = `/auth/update-password?reason=${passwordSetupReason(type)}`;
  }

  const returnOrigin = await resolvePostConfirmReturnOrigin({
    requestOrigin: origin,
    returnToRaw,
    businessId,
  });

  // Re-check allowlist when return_to was explicit (defense in depth).
  const allowedReturn =
    (await assertAllowedAuthReturnOrigin(returnToRaw)) ||
    (canonicalAuthHostsMatch(returnOrigin, origin)
      ? origin
      : await assertAllowedAuthReturnOrigin(returnOrigin)) ||
    origin;

  const absoluteDest = joinPortalPath(allowedReturn, destPath);

  let finalUrl = absoluteDest;
  if (
    user &&
    session?.access_token &&
    session.refresh_token &&
    !canonicalAuthHostsMatch(allowedReturn, origin)
  ) {
    try {
      finalUrl = await resolveCrossOriginRedirect({
        currentOrigin: origin,
        redirect: absoluteDest,
        userId: user.id,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    } catch (err) {
      console.error("[auth/confirm/verify] handoff mint failed", err);
      return NextResponse.redirect(
        `${origin}/login?error=handoff_failed&message=${encodeURIComponent("Could not continue to your portal")}`
      );
    }
  } else if (canonicalAuthHostsMatch(allowedReturn, origin)) {
    finalUrl = `${origin}${destPath.startsWith("/") ? destPath : `/${destPath}`}`;
  }

  const finalRedirect = NextResponse.redirect(finalUrl);
  cookiesToCopy.forEach(({ name, value, options }) => {
    finalRedirect.cookies.set(name, value, options);
  });
  response.cookies.getAll().forEach((c) => {
    if (!cookiesToCopy.some((x) => x.name === c.name)) {
      finalRedirect.cookies.set(c);
    }
  });
  return finalRedirect;
}
