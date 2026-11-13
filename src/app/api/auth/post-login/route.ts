import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { resolveLoginDestination } from "@/lib/auth-login-resolve";
import { resolveCrossOriginRedirect } from "@/lib/auth-session-handoff";
import { isVercelPreviewHost } from "@/lib/portal-url";
import { sameOriginRelativePath } from "@/lib/safe-relative-path";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const result = await resolveLoginDestination(profile, user);

  if (result.kind === "error") {
    if (result.signOut) {
      await supabase.auth.signOut();
    }
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  const origin = new URL(request.url).origin;
  let redirect = result.redirect;

  if (session?.access_token && session.refresh_token) {
    try {
      redirect = await resolveCrossOriginRedirect({
        currentOrigin: origin,
        redirect: result.redirect,
        userId: user.id,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    } catch (err) {
      console.error("[auth/post-login] handoff mint failed", err);
      return NextResponse.json(
        { error: "Could not complete sign-in handoff. Try again from your studio portal." },
        { status: 500 }
      );
    }
  }

  // Vercel Preview: answer with an app-relative path (e.g. /b/{slug}/admin) so the browser stays
  // on this preview hostname. Production and local dev are unchanged.
  const requestUrl = new URL(request.url);
  if (isVercelPreviewHost(requestUrl.hostname)) {
    redirect = sameOriginRelativePath(redirect, requestUrl.origin) ?? "/";
  }

  return NextResponse.json({ redirect });
}

