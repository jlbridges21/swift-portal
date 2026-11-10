import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyHostHeaders,
  classifyWebsiteDomainPath,
  lookupWebsiteRedirects,
  lookupBusinessById,
  lookupBusinessByIdFresh,
  PATH_TENANT_COOKIE,
  resolveRequestHost,
  type HostResolution,
} from "@/lib/host-resolution";
import { resolveWebsiteRedirect } from "@/lib/website/settings";
import {
  getBusinessPortalOrigin,
  getLoginRedirectOrigin,
  getPlatformApexHostname,
  isBarePlatformApexHostname,
} from "@/lib/portal-url";
import { verifyImpersonationCookie, SA_BUSINESS_CONTEXT_COOKIE } from "@/lib/platform-session";
import {
  IMPERSONATION_READONLY_CODE,
  IMPERSONATION_READONLY_MESSAGE,
  isReadOnlyPostExemptPath,
} from "@/lib/impersonation-readonly";
import {
  buildPartnerRefCookieValue,
  lookupActiveLandingReferralCode,
  PARTNER_REF_COOKIE,
  partnerRefCookieOptions,
} from "@/lib/partner-referral";
import { isReservedAppRouteSlug } from "@/lib/reserved-subdomains";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  getSubscriptionState,
  isClientMutatingApi,
  isPaywallApiExempt,
  paywallApiBody,
} from "@/lib/subscription";
import { NEEDS_PASSWORD_COOKIE } from "@/lib/auth-password-gate";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import {
  parseSignupIntentCookie,
  parseSignupInterval,
  SIGNUP_INTENT_COOKIE,
  signupIntentCookieDomain,
} from "@/lib/signup-intent";
import { needsOnboardingRedirect } from "@/lib/onboarding";
import {
  isActiveStaff,
  staffHasAnyArea,
  staffHomePath,
  staffMayAccessAdminPath,
} from "@/lib/staff-access";
import type { Profile } from "@/lib/types";

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

/**
 * Cross-origin middleware redirects must not mint handoff tokens here (Edge has no
 * node:crypto / service-role path). Bounce through a Node route that holds the
 * session cookie and issues the handoff.
 */
function redirectViaSessionContinue(request: NextRequest, destAbsolute: string): NextResponse {
  try {
    const dest = new URL(destAbsolute);
    const currentHost = (inboundHost(request).split(":")[0] || "").toLowerCase();
    if (dest.hostname.toLowerCase() === currentHost) {
      return NextResponse.redirect(destAbsolute);
    }
  } catch {
    return NextResponse.redirect(destAbsolute);
  }
  const bridge = request.nextUrl.clone();
  bridge.pathname = "/api/auth/session-continue";
  bridge.search = "";
  bridge.searchParams.set("next", destAbsolute);
  return NextResponse.redirect(bridge);
}

async function handleWebsiteDomain(request: NextRequest, resolution: HostResolution): Promise<NextResponse | null> {
  const business = resolution.business!;
  const path = request.nextUrl.pathname;
  const isRead = request.method === "GET" || request.method === "HEAD";
  // Bare/www alternate: Vercel normally redirects at the edge; this is the fallback.
  if (resolution.websiteAlternate && resolution.websiteDomain) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${resolution.websiteDomain}`);
    return NextResponse.redirect(url, isRead ? 308 : 307);
  }
  const route = classifyWebsiteDomainPath(path);
  if (route.kind === "page") return null;
  if (route.kind === "api_blocked") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (route.kind === "portal") {
    const origin = getBusinessPortalOrigin(business);
    return NextResponse.redirect(`${origin}${path}${request.nextUrl.search}`, 307);
  }
  // Unknown path — an old-website URL? Business redirects first, then common aliases.
  if (isRead) {
    try {
      const redirects = await lookupWebsiteRedirects(business.id);
      const target = resolveWebsiteRedirect({ redirects }, path);
      if (target && target !== path.toLowerCase()) {
        const url = request.nextUrl.clone();
        url.pathname = target;
        url.search = "";
        return NextResponse.redirect(url, 308);
      }
    } catch (err) {
      console.error("[website-domain] redirect lookup failed", err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  const inbound = inboundHost(request);
  const inboundHostname = inbound.split(":")[0]?.toLowerCase() ?? "";

  // Canonicalize bare apex → www before any OAuth / session work so PKCE cookies
  // are never set on shootportal.app while callback lands on www (or vice versa).
  if (
    process.env.NODE_ENV === "production" &&
    isBarePlatformApexHostname(inboundHostname) &&
    request.method === "GET"
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = getPlatformApexHostname();
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const resolution = await resolveRequestHost({
    hostname: inbound,
    pathname: request.nextUrl.pathname,
    pathCookie: request.cookies.get(PATH_TENANT_COOKIE)?.value ?? null,
  });

  const requestHeaders = new Headers(request.headers);
  applyHostHeaders(requestHeaders, resolution);

  // Property website domain (listings.yourstudio.com): public listing pages only. No portal
  // session, auth redirects or tenant UI ever run on this host.
  if (resolution.source === "listing_domain") {
    return buildSessionResponse(request, requestHeaders, resolution);
  }

  // Business Website domain (www.yourstudio.com): the public website only. Portal paths
  // (sign-in, dashboard, admin, share links…) move to the client portal address; no portal
  // session or auth logic runs on this host. Old-website paths can redirect to new pages.
  if (resolution.source === "website_domain" && resolution.business) {
    const websiteResponse = await handleWebsiteDomain(request, resolution);
    if (websiteResponse) return websiteResponse;
    return buildSessionResponse(request, requestHeaders, resolution);
  }

  // Partner referral (?ref=) — platform apex only. Never on tenant / custom domain.
  // Last-touch: a newer valid code replaces an older cookie. Strip ?ref from the URL.
  if (resolution.kind === "platform" && request.nextUrl.searchParams.has("ref")) {
    const rawRef = request.nextUrl.searchParams.get("ref") ?? "";
    const url = request.nextUrl.clone();
    url.searchParams.delete("ref");
    const response = NextResponse.redirect(url);
    try {
      const signed = await buildPartnerRefCookieValue(rawRef, "link");
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

  // Partner landing /{slug} cookie — platform apex only. Source = landing_page.
  // Static routes are reserved and skipped; inactive/unknown slugs set nothing (page 404s).
  let partnerLandingCookie: string | null = null;
  if (resolution.kind === "platform") {
    const path = request.nextUrl.pathname;
    const m = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
    if (m && !isReservedAppRouteSlug(m[1])) {
      try {
        const code = await lookupActiveLandingReferralCode(m[1]);
        if (code) {
          partnerLandingCookie = await buildPartnerRefCookieValue(code, "landing_page");
        }
      } catch (err) {
        console.error("[partner-landing] cookie lookup failed", {
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  let supabaseResponse = buildSessionResponse(request, requestHeaders, resolution);
  if (partnerLandingCookie) {
    supabaseResponse.cookies.set(
      PARTNER_REF_COOKIE,
      partnerLandingCookie,
      partnerRefCookieOptions()
    );
  }

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
          if (partnerLandingCookie) {
            supabaseResponse.cookies.set(
              PARTNER_REF_COOKIE,
              partnerLandingCookie,
              partnerRefCookieOptions()
            );
          }
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
  // Public property websites (Marketing Kit) on the ShootPortal fallback URL: like share links,
  // a signed-in session (any business) must not redirect the visitor. Unlike share links they
  // are meant to be indexed, so they are excluded from the noindex header below.
  const isPublicListingPath = path === "/l" || path.startsWith("/l/") || path.startsWith("/api/public/listing/");
  const method = request.method.toUpperCase();
  // Photo/folder share links and public videos (watch page + website embeds) are
  // authorized by their token alone. A signed-in session (any business, any state)
  // must not redirect or sign out the viewer.
  const isPhotoSharePath =
    path.startsWith("/photo/") ||
    path.startsWith("/folder/") ||
    path.startsWith("/api/public/photo/") ||
    path.startsWith("/v/") ||
    path.startsWith("/embed/") ||
    path.startsWith("/api/public/video/") ||
    isPublicListingPath;

  const protectedPaths = [
    "/dashboard",
    "/admin",
    "/staff",
    "/platform",
    "/billing",
    "/onboarding",
    "/partner",
    "/finish-setup",
    "/property-preview",
  ];
  // Segment-boundary match: bare startsWith would make the public /partners
  // marketing page match the protected /partner dashboard prefix.
  const isProtected = protectedPaths.some((p) => path === p || path.startsWith(`${p}/`));

  // Self-serve signup / OAuth finish-setup are platform-apex only — never on a tenant host.
  if (
    (path === "/signup" ||
      path.startsWith("/signup/") ||
      path === "/api/signup" ||
      path.startsWith("/api/signup/") ||
      path === "/finish-setup" ||
      path.startsWith("/finish-setup/") ||
      path === "/api/auth/finish-setup" ||
      path.startsWith("/api/auth/finish-setup/")) &&
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
      .select("role, business_id, client_id, email, staff_permissions, disabled_at")
      .eq("id", user.id)
      .single();

    // Build a minimal Profile for staff path checks (middleware select is partial).
    const staffProfile = profile
      ? ({
          id: user.id,
          role: profile.role,
          business_id: profile.business_id,
          client_id: profile.client_id,
          email: profile.email,
          staff_permissions: profile.staff_permissions,
          disabled_at: profile.disabled_at,
        } as Profile)
      : null;

    // Disabled staff — same soft lockout as unavailable business (no portal_unavailable loop).
    if (
      profile?.role === "staff" &&
      profile.disabled_at &&
      !isPhotoSharePath &&
      !path.startsWith("/login") &&
      !path.startsWith("/api/auth/") &&
      !isApi
    ) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}/login`;
      url.searchParams.set("error", "unavailable");
      url.searchParams.delete("redirect");
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    // Invite / recovery / temp-password: must set password before using the app.
    const mustChangePassword =
      request.cookies.get(NEEDS_PASSWORD_COOKIE)?.value === "1" ||
      user.user_metadata?.must_change_password === true;
    const passwordSetupExempt =
      path.startsWith("/auth/update-password") ||
      path.startsWith("/auth/confirm") ||
      path.startsWith("/auth/handoff") ||
      path.startsWith("/auth/oauth") ||
      path.startsWith("/auth/share") ||
      isPhotoSharePath ||
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

    if (businessUnavailable && !path.startsWith("/login") && !isApi && !isPhotoSharePath) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}/login`;
      url.searchParams.set("error", "unavailable");
      url.searchParams.delete("redirect");
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    // Authenticated shared viewers on platform apex must reach their tenant portal
    // (same class of bug as business admins on apex — session cookie is host-scoped).
    if (
      !isApi &&
      resolution.kind === "platform" &&
      profile?.role !== "super_admin" &&
      !profile?.business_id &&
      profile?.email &&
      (path === "/dashboard" ||
        path.startsWith("/dashboard/"))
    ) {
      const { listSharedBusinessIdsForEmail } = await import("@/lib/project-shares");
      const shareBizIds = await listSharedBusinessIdsForEmail(profile.email);
      if (shareBizIds.length > 0) {
        const shareBiz = await lookupBusinessById(shareBizIds[0]!);
        if (shareBiz && shareBiz.status === "active") {
          const destOrigin = getLoginRedirectOrigin(
            shareBiz,
            { hostname: inboundHostname, origin: request.nextUrl.origin },
            { foreignTenantHost: true }
          );
          const dest = `${destOrigin}${path}${request.nextUrl.search}`;
          return applyPathCookie(redirectViaSessionContinue(request, dest), resolution);
        }
      }
    }

    // Authenticated tenant users on the platform apex must not stay on /dashboard|/admin —
    // there is no tenant context on the marketing host (would throw a generic error page).
    if (
      !isApi &&
      resolution.kind === "platform" &&
      ownBusiness &&
      profile?.role !== "super_admin" &&
      (path === "/dashboard" ||
        path.startsWith("/dashboard/") ||
        path === "/admin" ||
        path.startsWith("/admin/") ||
        path === "/billing" ||
        path.startsWith("/billing/") ||
        path === "/onboarding" ||
        path.startsWith("/onboarding/"))
    ) {
      const destPath =
        path.startsWith("/admin") || path.startsWith("/billing") || path.startsWith("/onboarding")
          ? path
          : "/dashboard";
      const destOrigin = getLoginRedirectOrigin(
        ownBusiness,
        { hostname: inboundHost(request), origin: request.nextUrl.origin }
      );
      const dest = `${destOrigin}${destPath}${request.nextUrl.search}`;
      return applyPathCookie(redirectViaSessionContinue(request, dest), resolution);
    }

    if (
      !isApi &&
      !isPhotoSharePath &&
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
      const dest = `${destOrigin}${path}${request.nextUrl.search}`;
      return applyPathCookie(redirectViaSessionContinue(request, dest), resolution);
    }

    // Super admin demo signup (/signup?source=admin-demo) stays on the page; the page and
    // /api/signup re-verify super_admin server-side before offering or honoring the bypass.
    const superAdminDemoSignup =
      profile?.role === "super_admin" &&
      path === "/signup" &&
      request.nextUrl.searchParams.get("source") === "admin-demo";
    if (
      user &&
      // "/app" is the installed-app entry (manifest start_url): signed-in users skip straight
      // to their role's home through the same destination logic as a signed-in /login visit.
      (path === "/login" || path === "/signup" || path === "/app") &&
      !businessUnavailable &&
      !superAdminDemoSignup
    ) {
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
      // Signed-in admin clicked Subscribe Now (/signup?plan=…): go straight to plan checkout.
      const subscribeInterval =
        profile?.role === "admin" && path === "/signup"
          ? parseSignupInterval(request.nextUrl.searchParams.get("plan"))
          : null;
      const destPath = subscribeInterval
        ? `/billing?plan=${subscribeInterval}`
        : adminPaywalled
        ? "/billing"
        : needsWizard
          ? "/onboarding"
          : profile?.role === "admin"
            ? "/admin"
            : profile?.role === "staff" && staffProfile
              ? staffHomePath(staffProfile)
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
        const dest = `${destOrigin}${destPath}`;
        return applyPathCookie(redirectViaSessionContinue(request, dest), resolution);
      }

      // Shared viewer — passwordless project_shares (profiles.business_id stays NULL).
      if (profile?.email) {
        const { listActiveShareProjectIdsForEmail, listSharedBusinessIdsForEmail } = await import(
          "@/lib/project-shares"
        );
        let targetBusinessId: string | null = null;
        if (resolution.kind === "tenant" && resolution.business?.id) {
          const onTenantShares = await listActiveShareProjectIdsForEmail(
            profile.email,
            resolution.business.id
          );
          if (onTenantShares.length > 0) targetBusinessId = resolution.business.id;
        } else {
          const bizIds = await listSharedBusinessIdsForEmail(profile.email);
          if (bizIds.length > 0) targetBusinessId = bizIds[0]!;
        }
        if (targetBusinessId) {
          const shareBiz = await lookupBusinessById(targetBusinessId);
          if (shareBiz && shareBiz.status === "active") {
            const sharedProjectIds = await listActiveShareProjectIdsForEmail(
              profile.email,
              targetBusinessId
            );
            const shareDestPath =
              sharedProjectIds.length === 1
                ? `/dashboard/projects/${sharedProjectIds[0]}`
                : "/dashboard";
            const onOwnTenant =
              resolution.kind === "tenant" && resolution.business?.id === shareBiz.id;
            const destOrigin = getLoginRedirectOrigin(
              shareBiz,
              { hostname: inboundHost(request), origin: request.nextUrl.origin },
              { foreignTenantHost: !onOwnTenant }
            );
            const dest = `${destOrigin}${shareDestPath}`;
            return applyPathCookie(redirectViaSessionContinue(request, dest), resolution);
          }
        }
      }

      // No business_id: partners go to /partner; OAuth unfinished on apex → finish-setup.
      // Do not dump unresolved users onto /dashboard.
      const { resolvePartnerAccess } = await import("@/lib/partner-dashboard");
      const partnerAccess = await resolvePartnerAccess(user.id);
      if (partnerAccess.kind === "active" || partnerAccess.kind === "suspended") {
        const url = request.nextUrl.clone();
        url.pathname = "/partner";
        url.search = "";
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }

      const providers = user.app_metadata?.providers;
      const hasOauth =
        (Array.isArray(providers) && providers.some((p) => p && p !== "email")) ||
        (typeof user.app_metadata?.provider === "string" &&
          user.app_metadata.provider !== "email") ||
        (Array.isArray(user.identities) &&
          user.identities.some((i) => i.provider && i.provider !== "email"));
      if (hasOauth && resolution.kind !== "tenant") {
        const url = request.nextUrl.clone();
        url.pathname = "/finish-setup";
        url.search = "";
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
    }

    if (path.startsWith("/admin")) {
      const isOwner =
        profile?.role === "admin" || profile?.role === "super_admin";
      const isStaffOk =
        staffProfile &&
        isActiveStaff(staffProfile) &&
        staffMayAccessAdminPath(staffProfile, path);

      if (!isOwner && !isStaffOk) {
        const url = request.nextUrl.clone();
        if (staffProfile && profile?.role === "staff") {
          // Zero areas or denied path → staff home (never error/sign-out).
          url.pathname = `${resolution.pathPrefix}${staffHomePath(staffProfile)}`;
        } else {
          url.pathname = `${resolution.pathPrefix}/dashboard`;
        }
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }

      // Staff with areas but hitting shell /admin → bounce to first area home.
      if (
        staffProfile &&
        isActiveStaff(staffProfile) &&
        (path === "/admin" || path === "/admin/") &&
        staffHasAnyArea(staffProfile)
      ) {
        const home = staffHomePath(staffProfile);
        if (home !== "/admin" && home !== "/staff") {
          const url = request.nextUrl.clone();
          url.pathname = `${resolution.pathPrefix}${home}`;
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }
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
      // Re-fetch when cache says "needs wizard" so a just-deferred write is visible
      // (Edge middleware cache is not shared with the Node API isolate).
      if (!isApi && profile?.role === "admin" && ownBusiness) {
        let obBusiness = ownBusiness;
        if (
          needsOnboardingRedirect({
            onboardingCompletedAt: obBusiness.onboarding_completed_at,
            onboardingState: obBusiness.onboarding_state,
            role: profile.role,
          })
        ) {
          const fresh = await lookupBusinessByIdFresh(obBusiness.id);
          if (fresh) obBusiness = fresh;
        }
        if (
          needsOnboardingRedirect({
            onboardingCompletedAt: obBusiness.onboarding_completed_at,
            onboardingState: obBusiness.onboarding_state,
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
    }

    if (path.startsWith("/onboarding")) {
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname =
          staffProfile && profile?.role === "staff"
            ? `${resolution.pathPrefix}${staffHomePath(staffProfile)}`
            : `${resolution.pathPrefix}/dashboard`;
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
        url.pathname =
          staffProfile && profile?.role === "staff"
            ? `${resolution.pathPrefix}${staffHomePath(staffProfile)}`
            : `${resolution.pathPrefix}/dashboard`;
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

    // Staff hitting /admin/settings is covered by staffMayAccessAdminPath (adminOnly).
    // Explicit settings redirect for clarity when somehow past the gate:
    if (
      !isApi &&
      staffProfile &&
      isActiveStaff(staffProfile) &&
      path.startsWith("/admin/settings")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `${resolution.pathPrefix}${staffHomePath(staffProfile)}`;
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    // -------------------------------------------------------------------------
    // Subscription paywall — DO NOT sign the user out (unlike businessUnavailable).
    // Expired admins must stay signed in so they can reach /billing and subscribe.
    // super_admin is never gated; impersonation keeps access and shows state in UI.
    // -------------------------------------------------------------------------
    if (profile && profile.role !== "super_admin" && ownBusiness) {
      let sub = getSubscriptionState(ownBusiness);
      if (sub.requiresPayment && profile.business_id) {
        // The host lookup is cached per instance for 30s. Before blocking, re-read: the admin may
        // have just paid or started their free trial on another instance.
        const fresh = await lookupBusinessByIdFresh(profile.business_id);
        if (fresh) sub = getSubscriptionState(fresh);
      }
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

    // Subscribe Now intent carried through an existing-user login (cookie set on /signup for the
    // platform root domain). A trialing admin landing on /admin or /onboarding is sent to plan
    // selection once; the cookie is then cleared. Paywalled accounts already land on /billing.
    if (
      !isApi &&
      method === "GET" &&
      profile?.role === "admin" &&
      ownBusiness &&
      ownBusiness.subscription_status === "trialing" &&
      (path === "/admin" || path === "/onboarding")
    ) {
      const intent = parseSignupIntentCookie(request.cookies.get(SIGNUP_INTENT_COOKIE)?.value);
      if (intent?.path === "subscribe") {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/billing`;
        url.search = intent.interval ? `?plan=${intent.interval}` : "";
        const res = NextResponse.redirect(url);
        const domain = signupIntentCookieDomain(inboundHost(request), getPlatformRootDomain());
        res.cookies.set(SIGNUP_INTENT_COOKIE, "", { path: "/", maxAge: 0, ...(domain ? { domain } : {}) });
        return applyPathCookie(res, resolution);
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
            : staffProfile && profile?.role === "staff"
              ? `${resolution.pathPrefix}${staffHomePath(staffProfile)}`
              : `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
      }
    }

    // Shared viewers — block client-only surfaces outside their share list.
    if (
      profile?.email &&
      !profile.business_id &&
      !profile.client_id &&
      profile.role !== "super_admin" &&
      resolution.kind === "tenant" &&
      resolution.business?.id
    ) {
      const { listActiveShareProjectIdsForEmail } = await import("@/lib/project-shares");
      const sharedProjectIds = await listActiveShareProjectIdsForEmail(
        profile.email,
        resolution.business.id
      );
      if (sharedProjectIds.length > 0) {
        const blockedClientPaths = ["/dashboard/request", "/dashboard/settings"];
        const isBlockedPath = blockedClientPaths.some(
          (p) => path === p || path.startsWith(`${p}/`)
        );
        if (isBlockedPath) {
          if (isApi) {
            return applyPathCookie(
              NextResponse.json({ error: "Not found." }, { status: 404 }),
              resolution
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = `${resolution.pathPrefix}/dashboard`;
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }

        const projectMatch = path.match(/^\/dashboard\/projects\/([^/]+)/);
        if (projectMatch && !sharedProjectIds.includes(projectMatch[1]!)) {
          if (isApi) {
            return applyPathCookie(
              NextResponse.json({ error: "Not found." }, { status: 404 }),
              resolution
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = `${resolution.pathPrefix}/dashboard`;
          return applyPathCookie(NextResponse.redirect(url), resolution);
        }
      }
    }

    if (profile?.role === "super_admin") {
      const claims = verifyImpersonationCookie(request.cookies.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
      if (claims) {
        const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
        const platformApi = path.startsWith("/api/platform");
        const authApi = path.startsWith("/api/auth");
        const readOnlyPostExempt = isReadOnlyPostExemptPath(path);
        if (mutating && !claims.allowWrites && !platformApi && !authApi && !readOnlyPostExempt) {
          return applyPathCookie(
            NextResponse.json(
              {
                error: IMPERSONATION_READONLY_MESSAGE,
                code: IMPERSONATION_READONLY_CODE,
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

  if (path.startsWith("/view/") || path.startsWith("/w9/") || (isPhotoSharePath && !isPublicListingPath)) {
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    supabaseResponse.headers.set("Cache-Control", "private, no-store");
  }

  return applyPathCookie(supabaseResponse, resolution);
}
