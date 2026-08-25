import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCrossOriginRedirect } from "@/lib/auth-session-handoff";

export const dynamic = "force-dynamic";

/**
 * Middleware bridge for cross-origin post-auth redirects.
 * Holds the session on the current host, mints a handoff when needed, then
 * sends the browser to the destination (or /auth/handoff interstitial).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "";
  const origin = url.origin;

  if (!next.startsWith("http://") && !next.startsWith("https://")) {
    return NextResponse.redirect(`${origin}/login?error=handoff_failed`);
  }

  let dest: URL;
  try {
    dest = new URL(next);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=handoff_failed`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user || !session?.access_token || !session.refresh_token) {
    return NextResponse.redirect(`${origin}/login?redirect=${encodeURIComponent(dest.pathname)}`);
  }

  try {
    const finalUrl = await resolveCrossOriginRedirect({
      currentOrigin: origin,
      redirect: dest.toString(),
      userId: user.id,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    });
    return NextResponse.redirect(finalUrl);
  } catch (err) {
    console.error("[auth/session-continue] handoff mint failed", err);
    return NextResponse.redirect(
      `${origin}/login?error=handoff_failed&message=${encodeURIComponent("Could not continue to your portal")}`
    );
  }
}
