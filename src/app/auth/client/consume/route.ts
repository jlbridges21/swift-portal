import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { allowShareAccessExchange } from "@/lib/share-access-rate-limit";
import { requestIp } from "@/lib/portal-activation-rate-limit";
import { exchangeClientAccessToken } from "@/lib/client-access-link-server";
import { CLIENT_ACCESS_PATH } from "@/lib/client-access-link";

export const dynamic = "force-dynamic";

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  return (
    header
      ?.split("; ")
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf("=");
        return { name: i >= 0 ? c.slice(0, i) : c, value: i >= 0 ? decodeURIComponent(c.slice(i + 1)) : "" };
      }) ?? []
  );
}

/**
 * POST from the /auth/client landing: exchange a one-click client link for a
 * session as that client, then land on their project. Refusals go back to the
 * landing page, which explains and offers a fresh link.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "").trim();

  const host = await getPublicHostContext();
  const prefix = host.source === "path" && host.slug ? `/b/${host.slug}` : "";
  const back = (reason: string) =>
    NextResponse.redirect(
      `${origin}${prefix}${CLIENT_ACCESS_PATH}?token=${encodeURIComponent(token)}&error=${encodeURIComponent(reason)}`,
      303
    );

  if (!token) return NextResponse.redirect(`${origin}${prefix}${CLIENT_ACCESS_PATH}`, 303);
  if (!isActivePublicTenant(host)) return back("wrong_business");

  const fingerprint = createHash("sha256").update(token).digest("hex").slice(0, 16);
  if (!allowShareAccessExchange(requestIp(request), `client:${fingerprint}`)) return back("rate_limited");

  const result = await exchangeClientAccessToken(token, host.businessId);
  if (!result.ok) return back(result.reason);

  const destPath = result.destinationPath.startsWith("/") ? result.destinationPath : `/${result.destinationPath}`;
  const response = NextResponse.redirect(`${origin}${prefix}${destPath}`, 303);
  const cookiesToCopy: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie"));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
          cookiesToCopy.push({ name, value, options });
        });
      },
    },
  });

  const { error } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });
  if (error) {
    console.error("[auth/client/consume] setSession failed", error.message);
    return back("sign_in_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== result.userId) {
    await supabase.auth.signOut();
    return back("sign_in_failed");
  }

  cookiesToCopy.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
