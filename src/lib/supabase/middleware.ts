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

  const protectedPaths = ["/dashboard", "/admin", "/platform"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));

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

    const ownBusiness = profile?.business_id ? await lookupBusinessById(profile.business_id) : null;
    const businessUnavailable =
      Boolean(profile?.business_id) &&
      profile?.role !== "super_admin" &&
      (!ownBusiness || ownBusiness.status !== "active");

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
      });
      const dest = new URL(`${destOrigin}${path}${request.nextUrl.search}`);
      return applyPathCookie(NextResponse.redirect(dest), resolution);
    }

    if (user && (path === "/login" || path === "/signup") && !businessUnavailable) {
      const url = request.nextUrl.clone();
      url.pathname =
        profile?.role === "super_admin"
          ? "/platform"
          : profile?.role === "admin"
            ? `${resolution.pathPrefix}/admin`
            : `${resolution.pathPrefix}/dashboard`;
      return applyPathCookie(NextResponse.redirect(url), resolution);
    }

    if (path.startsWith("/admin")) {
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = `${resolution.pathPrefix}/dashboard`;
        return applyPathCookie(NextResponse.redirect(url), resolution);
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
  }

  return applyPathCookie(supabaseResponse, resolution);
}
