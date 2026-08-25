import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  NEEDS_PASSWORD_COOKIE,
  needsPasswordCookieOptions,
} from "@/lib/auth-password-gate";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveLoginDestination } from "@/lib/auth-login-resolve";
import { resolveCrossOriginRedirect } from "@/lib/auth-session-handoff";
import type { Profile } from "@/lib/types";

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
 * OAuth (Google) also returns here with ?code= after signInWithOAuth PKCE.
 * Destination is resolved via resolveLoginDestination (business / client / partner /
 * finish-setup / reject) — not a naive role dump to /dashboard.
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

function copyCookies(
  target: NextResponse,
  cookiesToCopy: { name: string; value: string; options?: CookieOptions }[],
  source?: NextResponse
) {
  cookiesToCopy.forEach(({ name, value, options }) => {
    target.cookies.set(name, value, options);
  });
  source?.cookies.getAll().forEach((c) => {
    if (!cookiesToCopy.some((x) => x.name === c.name)) {
      target.cookies.set(c);
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));
  const origin = url.origin;
  const passwordGate = needsPasswordSetup(url);
  const isOAuthCodeFlow = Boolean(code) && !tokenHash;

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
    // OAuth PKCE failures must not use invite/reset "email scanner" copy.
    if (isOAuthCodeFlow) {
      const fail = new URL(`${origin}/login`);
      fail.searchParams.set("error", "oauth_exchange");
      fail.searchParams.set("message", exchangeError.slice(0, 200));
      return NextResponse.redirect(fail.toString());
    }
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (user) {
        const honorNext =
          next.startsWith("/auth/") ||
          next.startsWith("/dashboard/settings") ||
          next.startsWith("/login");
        if (!honorNext) {
          const service = await createServiceClient();
          const { data: profileRow } = await service
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (profileRow) {
            const resolved = await resolveLoginDestination(profileRow as Profile, user, {
              requestHost: url.host,
              requestOrigin: origin,
            });
            if (resolved.kind === "error") {
              if (resolved.signOut) {
                await supabase.auth.signOut();
              }
              const fail = new URL(`${origin}/login`);
              fail.searchParams.set("error", resolved.code || "unavailable");
              fail.searchParams.set("code", resolved.code || "unavailable");
              const failRedirect = NextResponse.redirect(fail.toString());
              copyCookies(failRedirect, cookiesToCopy, response);
              return failRedirect;
            }
            dest = resolved.redirect;
            if (dest.startsWith("http://") || dest.startsWith("https://")) {
              let finalUrl = dest;
              if (session?.access_token && session.refresh_token) {
                try {
                  finalUrl = await resolveCrossOriginRedirect({
                    currentOrigin: origin,
                    redirect: dest,
                    userId: user.id,
                    accessToken: session.access_token,
                    refreshToken: session.refresh_token,
                  });
                } catch (err) {
                  console.error("[auth/callback] handoff mint failed", err);
                }
              }
              const absolute = NextResponse.redirect(finalUrl);
              copyCookies(absolute, cookiesToCopy, response);
              return absolute;
            }
          }
        } else {
          dest = next;
        }
      }
    } catch (err) {
      console.error("[auth/callback] role resolve failed", err);
    }
  }

  let finalDest =
    dest.startsWith("http://") || dest.startsWith("https://")
      ? dest
      : `${origin}${dest.startsWith("/") ? dest : `/${dest}`}`;

  if (finalDest.startsWith("http://") || finalDest.startsWith("https://")) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (user && session?.access_token && session.refresh_token) {
        finalDest = await resolveCrossOriginRedirect({
          currentOrigin: origin,
          redirect: finalDest,
          userId: user.id,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      }
    } catch (err) {
      console.error("[auth/callback] handoff mint failed (final)", err);
    }
  }

  const finalRedirect = NextResponse.redirect(finalDest);
  copyCookies(finalRedirect, cookiesToCopy, response);
  return finalRedirect;
}
