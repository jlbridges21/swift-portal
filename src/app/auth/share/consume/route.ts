import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { exchangeShareAccessToken } from "@/lib/project-share-access";

export const dynamic = "force-dynamic";

function requestHost(request: Request): string {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  return (forwarded || request.headers.get("host") || url.host).split(",")[0]?.trim() ?? "";
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

function loginRedirect(origin: string, code: string, email?: string | null): NextResponse {
  const params = new URLSearchParams({ error: code });
  if (email) params.set("email", email);
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "").trim();
  const host = requestHost(request);
  const origin = new URL(request.url).origin;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!token) {
    return NextResponse.redirect(
      `${origin}/auth/share?error=${encodeURIComponent("Missing share link token.")}`
    );
  }

  const result = await exchangeShareAccessToken({
    rawToken: token,
    requestHost: host,
    ipAddress: ip,
    userAgent,
  });

  if (!result.ok) {
    const email = "email" in result ? result.email : undefined;
    if (result.code === "rate_limited") {
      return NextResponse.redirect(
        `${origin}/login?error=share_rate_limited&message=${encodeURIComponent(result.message)}${email ? `&email=${encodeURIComponent(email)}` : ""}`
      );
    }
    if (
      result.code === "share_expired" ||
      result.code === "share_one_time_used" ||
      result.code === "share_revoked" ||
      result.code === "share_not_started"
    ) {
      return loginRedirect(origin, result.code, email);
    }
    return loginRedirect(origin, "share_invalid", email);
  }

  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];
  const destPath = result.destinationPath.startsWith("/")
    ? result.destinationPath
    : `/${result.destinationPath}`;
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

  const { error } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });

  if (error) {
    console.error("[auth/share/consume] setSession failed", error.message);
    return loginRedirect(origin, "share_invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== result.userId) {
    await supabase.auth.signOut();
    return loginRedirect(origin, "share_invalid");
  }

  cookiesToCopy.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
