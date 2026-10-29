/**
 * Browser helper: after a successful supabase.auth.signInWithPassword, ask the server where to go
 * (POST /api/auth/post-login). The new session cookie can lag the sign-in promise by a moment, so
 * a 401 is retried briefly before giving up with a friendly message (never a bare "Unauthorized").
 */
export type PostLoginResult = { ok: true; redirect: string } | { ok: false; error: string };

const RETRY_DELAYS_MS = [300, 700, 1500];

export async function resolvePostLoginRedirect(fallback: string): Promise<PostLoginResult> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/auth/post-login", { method: "POST", credentials: "include" });
    } catch {
      res = new Response(null, { status: 503 });
    }
    const body = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
    if (res.ok) return { ok: true, redirect: body.redirect || fallback };
    // 401 = session not visible to the server yet; 503 = network blip. Anything else is a real answer.
    const retryable = res.status === 401 || res.status === 503;
    if (!retryable || attempt === RETRY_DELAYS_MS.length) {
      return {
        ok: false,
        error:
          res.status === 401
            ? "We couldn't finish signing you in. Please try again."
            : body.error || "This portal is unavailable. Your business is suspended or no longer active.",
      };
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
  return { ok: false, error: "We couldn't finish signing you in. Please try again." };
}
