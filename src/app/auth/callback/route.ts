import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  NEEDS_PASSWORD_COOKIE,
  needsPasswordCookieOptions,
} from "@/lib/auth-password-gate";

const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "recovery",
  "email_change",
  "email",
  "magiclink",
]);

/**
 * Legacy / in-flight PKCE + ConfirmationURL redirects land here with ?code=.
 * New TokenHash emails use GET /auth/confirm (interstitial) → POST /auth/confirm/verify.
 * Dashboard implicit-flow emails still use hash fragments (AuthFragmentHandler).
 *
 * This route still accepts token_hash on GET for any old links; prefer the confirm
 * interstitial for new mail so scanners cannot consume the OTP.
 */
function needsPasswordSetup(url: URL): { needed: boolean; reason: "invite" | "recovery" | "setup" } {
  const type = url.searchParams.get("type");
  const spFlow = url.searchParams.get("sp_flow");
  const next = url.searchParams.get("next") || "";

  if (type === "invite" || spFlow === "invite") return { needed: true, reason: "invite" };
  if (type === "recovery" || spFlow === "recovery") return { needed: true, reason: "recovery" };
  if (next.startsWith("/auth/update-password")) return { needed: true, reason: "setup" };
  return { needed: false, reason: "setup" };
}

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));
  const origin = url.origin;
  const passwordGate = needsPasswordSetup(url);

  let dest = passwordGate.needed
    ? `/auth/update-password?reason=${passwordGate.reason}`
    : next;

  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];
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

  let exchangeError: string | null = null;

  if (tokenHash && typeParam && EMAIL_OTP_TYPES.has(typeParam)) {
    const { error } = await supabase.auth.verifyOtp({
      type: typeParam as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) exchangeError = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) exchangeError = error.message;
  } else {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  if (exchangeError) {
    console.error("[auth/callback] exchange failed", exchangeError);
    return NextResponse.redirect(`${origin}/login?error=otp_expired`);
  }

  if (passwordGate.needed) {
    const opts = needsPasswordCookieOptions();
    response.cookies.set(NEEDS_PASSWORD_COOKIE, "1", opts);
    cookiesToCopy.push({ name: NEEDS_PASSWORD_COOKIE, value: "1", options: opts });
  } else {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const honorNext =
          next.startsWith("/auth/") ||
          next.startsWith("/dashboard/settings") ||
          next.startsWith("/login");
        if (!honorNext) {
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
        } else {
          dest = next;
        }
      }
    } catch (err) {
      console.error("[auth/callback] role resolve failed", err);
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
