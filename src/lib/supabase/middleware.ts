import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyHostHeaders,
  lookupBusinessById,
  PATH_TENANT_COOKIE,
  resolveRequestHost,
  type HostResolution,
} from "@/lib/host-resolution";
import { getLoginRedirectOrigin } from "@/lib/portal-url";
import { verifyImpersonationCookie, SA_BUSINESS_CONTEXT_COOKIE } from "@/lib/platform-session";
import {
  buildPartnerRefCookieValue,
  PARTNER_REF_COOKIE,
  partnerRefCookieOptions,
} from "@/lib/partner-referral";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  getSubscriptionState,
  isClientMutatingApi,
  isPaywallApiExempt,
  paywallApiBody,
} from "@/lib/subscription";
import { NEEDS_PASSWORD_COOKIE } from "@/lib/auth-password-gate";
import { needsOnboardingRedirect } from "@/lib/onboarding";

function inboundHost(request: NextRequest): string {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
}

function buildSessionResponse(
  request: NextRequest,
  requestHeaders: Headers,
  resolution: HostResolution
) {
  if (resolution.rewritePathname != null) {
    const url = request.nextUrl.clone();
    url.pathname = resolution.rewritePathname;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function applyPathCookie(response: NextResponse, resolution: HostResolution) {
  if (resolution.setPathCookie) {
    response.cookies.set(PATH_TENANT_COOKIE, resolution.setPathCookie, {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  if (resolution.clearPathCookie) {
    response.cookies.delete(PATH_TENANT_COOKIE);
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  const resolution = await resolveRequestHost({
    hostname: inboundHost(request),
    pathname: request.nextUrl.pathname,
    pathCookie: request.cookies.get(PATH_TENANT_COOKIE)?.value ?? null,
  });

  const requestHeaders = new Headers(request.headers);
  applyHostHeaders(requestHeaders, resolution);

  // Partner referral (?ref=) — platform apex only. Never on tenant / custom domain.
  // Last-touch: a newer valid code replaces an older cookie. Strip ?ref from the URL.
  if (resolution.kind === "platform" && request.nextUrl.searchParams.has("ref")) {
    const rawRef = request.nextUrl.searchParams.get("ref") ?? "";
    const url = request.nextUrl.clone();
    url.searchParams.delete("ref");
    const response = NextResponse.redirect(url);
    try {
      const signed = await buildPartnerRefCookieValue(rawRef);
      if (signed) {
        response.cookies.set(PARTNER_REF_COOKIE, signed, partnerRefCookieOptions());
      }
    } catch (err) {
      console.error("[partner-ref] cookie set failed", {
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    return applyPathCookie(response, resolution);
  }

  let supabaseResponse = buildSessionResponse(request, requestHeaders, resolution);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = buildSessionResponse(request, requestHeaders, resolution);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          applyPathCookie(supabaseResponse, resolution);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = resolution.rewritePathname ?? request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const method = request.method.toUpperCase();

  const protectedPaths = ["/dashboard", "/admin", "/platform", "/billing", "/onboarding", "/partner"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));

  // Self-serve signup is platform-apex only — never on a tenant host.
  if (
    (path === "/signup" || path.startsWith("/signup/") || path === "/api/signup" || path.startsWith("/api/signup/")) &&
    resolution.kind === "tenant"
  ) {
    if (isApi) {
      return applyPathCookie(
        NextResponse.json(
          { error: "Sign up is only available on shootportal.app." },
          { status: 403 }
        ),
        resolution
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = `${resolution.pathPrefix}/`;
    return applyPathCookie(NextResponse.redirect(url), resolution);
  }

  // Partner applications are platform-apex only — never on a tenant host.
  if (
    (path === "/api/partners/apply" || path.startsWith("/api/partners/apply/")) &&
    resolution.kind === "tenant"
  ) {
    return applyPathCookie(
      NextResponse.json(
        { error: "Partner applications are only available on shootportal.app." },
        { status: 403 }
      ),
      resolution
    );
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    const prefix = resolution.pathPrefix;
    url.pathname = `${prefix}/login`;
    url.searchParams.set("redirect", path);
    return applyPathCookie(NextResponse.redirect(url), resolution);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, business_id")
      .eq("id", user.id)
      .single();

    // Invite / recovery / temp-password: must set password before using the app.
    const mustChangePassword =
      request.cookies.get(NEEDS_PASSWORD_COOKIE)?.value === "1" ||
      user.user_metadata?.must_change_password === true;
    const passwordSetupExempt =
      path.startsWith("/auth/update-password") ||
      path.startsWith("/auth/confirm") ||
      path.startsWith("/api/auth/") ||
      path.startsWith("/_next") ||
      path === "/favicon.ico";
    if (mustChangePassword && !passwordSetupExempt) {
      if (isApi) {
        return applyPathCookie(
          NextResponse.json(
            { error: "Set a password before continuing.", code: "password_setup_required" },
            { status: 403 }
          ),
          resolution
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}/auth/update-password`;
      if (user.user_metadata?.must_change_password === true) {
        url.search = "?reason=forced";
      } else if (!url.searchParams.get("reason")) {
        url.search = "?reason=setup";
      }
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    const ownBusiness = profile?.business_id ? await lookupBusinessById(profile.business_id) : null;
    const businessUnavailable =
      Boolean(profile?.business_id) &&
      profile?.role !== "super_admin" &&
      (!ownBusiness || ownBusiness.status !== "active" || Boolean(ownBusiness.deleted_at));

    if (businessUnavailable && !path.startsWith("/login") && !isApi) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}/login`;
      url.searchParams.set("error", "unavailable");
      url.searchParams.delete("redirect");
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    if (
      !isApi &&
      resolution.kind === "tenant" &&
      resolution.business &&
      profile?.role !== "super_admin" &&
      profile?.business_id &&
      profile.business_id !== resolution.business.id &&
      ownBusiness
    ) {
      const destOrigin = getLoginRedirectOrigin(ownBusiness, {
        hostname: inboundHost(request),
        origin: request.nextUrl.origin,
      }, { foreignTenantHost: true });
      const dest = new URL(`${destOrigin}${path}${request.nextUrl.search}`);
      return applyPathCookie(NextResponse.redirect(dest), resolution);
    }

    if (user && (path === "/login" || path === "/signup") && !businessUnavailable) {
      if (profile?.role === "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/platform";
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }

      const adminPaywalled =
        profile?.role === "admin" &&
        ownBusiness &&
        getSubscriptionState(ownBusiness).requiresPayment;
      const needsWizard =
        profile?.role === "admin" &&
        ownBusiness &&
        needsOnboardingRedirect({
          onboardingCompletedAt: ownBusiness.onboarding_completed_at,
          onboardingState: ownBusiness.onboarding_state,
          role: profile.role,
        });
      const destPath = adminPaywalled
        ? "/billing"
        : needsWizard
          ? "/onboarding"
          : profile?.role === "admin"
            ? "/admin"
            : "/dashboard";

      if (ownBusiness) {
        const onOwnTenant =
          resolution.kind === "tenant" &&
          resolution.business?.id === ownBusiness.id;
        const destOrigin = getLoginRedirectOrigin(
          ownBusiness,
          { hostname: inboundHost(request), origin: request.nextUrl.origin },
          { foreignTenantHost: !onOwnTenant }
        );
        const dest = new URL(`${destOrigin}${destPath}`);
        return applyPathCookie(NextResponse.redirect(dest), resolution);
      }

      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}${destPath}`;
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    if (path.startsWith("/admin")) {
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
      if (profile?.role === "super_admin" && !isApi) {
        const claims = verifyImpersonationCookie(request.cookies.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
        if (!claims) {
          const url = request.nextUrl.clone();
          url.pathname = "/platform";
          url.searchParams.set("notice", "impersonate");
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }
      }
      // Incomplete onboarding (not deferred) → wizard, not empty dashboard.
      if (
        !isApi &&
        profile?.role === "admin" &&
        ownBusiness &&
        needsOnboardingRedirect({
          onboardingCompletedAt: ownBusiness.onboarding_completed_at,
          onboardingState: ownBusiness.onboarding_state,
          role: profile.role,
        })
      ) {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/onboarding`;
        // Preserve Stripe Connect return signal so the wizard can refresh status.
        const stripe = request.nextUrl.searchParams.get("stripe");
        url.search = "";
        if (stripe) url.searchParams.set("stripe", stripe);
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
    }

    if (path.startsWith("/onboarding")) {
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
      if (profile?.role === "super_admin" && !isApi) {
        const claims = verifyImpersonationCookie(request.cookies.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
        if (!claims) {
          const url = request.nextUrl.clone();
          url.pathname = "/platform";
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }
        // Impersonating: skip wizard, go to admin.
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/admin`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
    }

    if (path.startsWith("/billing")) {
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
      if (profile?.role === "super_admin" && !isApi) {
        const claims = verifyImpersonationCookie(request.cookies.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
        if (!claims) {
          const url = request.nextUrl.clone();
          url.pathname = "/platform";
          url.searchParams.set("notice", "impersonate");
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Subscription paywall — DO NOT sign the user out (unlike businessUnavailable).
    // Expired admins must stay signed in so they can reach /billing and subscribe.
    // super_admin is never gated; impersonation keeps access and shows state in UI.
    // -------------------------------------------------------------------------
    if (profile && profile.role !== "super_admin" && ownBusiness) {
      const sub = getSubscriptionState(ownBusiness);
      if (sub.requiresPayment) {
        if (profile.role === "admin") {
          // Escape hatch only — see PAYWALL_API_EXEMPT_PREFIXES in subscription.ts.
          if (isApi && !isPaywallApiExempt(path)) {
            return applyPathCookie(
              NextResponse.json(paywallApiBody(sub), { status: 402 }),
              resolution
            );
          }
          if (!isApi && (path.startsWith("/admin") || path.startsWith("/onboarding"))) {
            const url = request.nextUrl.clone();
            url.pathname = `${resolution.pathPrefix}/billing`;
            url.search = "";
            return applyPathCookie(NextResponse.redirect(url), resolution);
          }
        } else if (profile.role === "client") {
          if (isClientMutatingApi(path, method)) {
            return applyPathCookie(
              NextResponse.json(
                {
                  ...paywallApiBody(sub),
                  error:
                    "This studio’s subscription is paused. You can still view existing projects and downloads, but new requests and messages are unavailable until they renew.",
                },
                { status: 402 }
              ),
              resolution
            );
          }
        }
      }
    }

    if (path.startsWith("/api/platform")) {
      if (profile?.role !== "super_admin") {
        return applyPathCookie(
          NextResponse.json({ error: "Super admin access required." }, { status: 403 }),
          resolution
        );
      }
    }

    if (path.startsWith("/platform")) {
      if (profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname =
          profile?.role === "admin"
            ? `${resolution.pathPrefix}/admin`
            : `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
    }

    if (profile?.role === "super_admin") {
      const claims = verifyImpersonationCookie(request.cookies.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
      if (claims) {
        const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
        const platformApi = path.startsWith("/api/platform");
        const authApi = path.startsWith("/api/auth");
        if (mutating && !claims.allowWrites && !platformApi && !authApi) {
          return applyPathCookie(
            NextResponse.json(
              {
                error:
                  "Impersonation is read-only. Confirm “allow writes” on the platform banner to change this business.",
              },
              { status: 403 }
            ),
            resolution
          );
        }
        const skipAudit =
          path.startsWith("/_next") ||
          path.startsWith("/favicon") ||
          path.startsWith("/api/platform");
        if (!skipAudit) {
          void writePlatformAudit({
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            action: "impersonation.request",
            targetBusinessId: claims.businessId,
            targetType: "request",
            metadata: { method, path, allowWrites: claims.allowWrites },
            ipAddress:
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              request.headers.get("x-real-ip"),
          });
        }
      }
    }
  }

  return applyPathCookie(supabaseResponse, resolution);
}
