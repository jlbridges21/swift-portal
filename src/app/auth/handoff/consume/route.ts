import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { consumeSessionHandoff } from "@/lib/auth-session-handoff";

export const dynamic = "force-dynamic";

function requestHost(request: Request): string {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  return (forwarded || request.headers.get("host") || url.host).split(",")[0]?.trim() ?? "";
}

/**
 * Consume a single-use handoff token and establish the Supabase session on this host.
 * Bound to destination_host — will not succeed on a different host.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "").trim();
  const host = requestHost(request);
  const origin = new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/auth/handoff?error=${encodeURIComponent("Missing token")}`);
  }

  const result = await consumeSessionHandoff({ rawToken: token, requestHost: host });
  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/login?error=handoff_failed&message=${encodeURIComponent(result.error)}`
    );
  }

  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];
  const destPath = result.destinationPath.startsWith("/") ? result.destinationPath : `/${result.destinationPath}`;
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
    console.error("[auth-handoff] setSession failed", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=handoff_failed&message=${encodeURIComponent("Could not restore session")}`
    );
  }

  // Re-verify the session belongs to the expected user (token binding).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== result.userId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=handoff_failed&message=${encodeURIComponent("Session user mismatch")}`
    );
  }

  cookiesToCopy.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
