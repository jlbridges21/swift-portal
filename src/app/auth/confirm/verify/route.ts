import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  isEmailOtpType,
  needsPasswordForOtpType,
  passwordSetupReason,
} from "@/lib/auth-confirm";
import {
  NEEDS_PASSWORD_COOKIE,
  needsPasswordCookieOptions,
} from "@/lib/auth-password-gate";

/**
 * POST only — human Continue button. Sole verifyOtp call for TokenHash email links.
 * Sibling of /auth/confirm (GET interstitial); Next.js forbids page+route in one segment.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") || "").trim();
  const typeRaw = String(form.get("type") || "").trim();

  if (!tokenHash || !isEmailOtpType(typeRaw)) {
    return NextResponse.redirect(`${origin}/login?error=otp_expired`);
  }
  const type = typeRaw as EmailOtpType;

  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];
  let dest = "/admin";
  const response = NextResponse.redirect(`${origin}${dest}`);

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

  if (needsPasswordForOtpType(type)) {
    const reason = passwordSetupReason(type);
    dest = `/auth/update-password?reason=${reason}`;
    const opts = needsPasswordCookieOptions();
    response.cookies.set(NEEDS_PASSWORD_COOKIE, "1", opts);
    cookiesToCopy.push({ name: NEEDS_PASSWORD_COOKIE, value: "1", options: opts });
  } else {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, business_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.role === "super_admin") dest = "/platform";
        else if (profile?.role === "admin") {
          const { adminHomePath } = await import("@/lib/onboarding");
          const { lookupBusinessById } = await import("@/lib/host-resolution");
          const biz = profile.business_id
            ? await lookupBusinessById(profile.business_id)
            : null;
          dest = adminHomePath({
            onboardingCompletedAt: biz?.onboarding_completed_at,
            onboardingState: biz?.onboarding_state,
          });
        } else if (profile?.role === "client") dest = "/dashboard";
        else dest = "/admin";
      }
    } catch (err) {
      console.error("[auth/confirm/verify] role resolve failed", err);
      dest = "/admin";
    }
  }

  const finalRedirect = NextResponse.redirect(`${origin}${dest}`);
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
