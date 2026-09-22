"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { safeAuthReturnToParam } from "@/lib/auth-confirm";

/**
 * Start Google OAuth on the canonical www host (PKCE cookie + callback stay together),
 * then auth/callback hands off to the tenant origin via auth_session_handoffs.
 */
function OAuthStartInner() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const returnTo = safeAuthReturnToParam(params.get("return_to"));

      const host = window.location.hostname.toLowerCase();
      const root = getPlatformRootDomain().toLowerCase();
      const onWww = host === `www.${root}` || host === "localhost" || host === "127.0.0.1";

      if (!onWww && process.env.NODE_ENV === "production") {
        const www = new URL(window.location.href);
        www.hostname = `www.${root}`;
        window.location.replace(www.toString());
        return;
      }

      if (returnTo) {
        try {
          sessionStorage.setItem("sp_oauth_return_to", returnTo);
        } catch {
          /* ignore */
        }
      }

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (cancelled) return;
      if (oauthError) {
        setError(oauthError.message);
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">
          {error ? "Google sign-in didn’t start" : "Continuing with Google…"}
        </h1>
        <p className="text-sm text-slate-600">
          {error || "You’ll return to your studio portal when sign-in finishes."}
        </p>
        {error ? (
          <Button type="button" onClick={() => window.location.assign("/login")}>
            Back to sign in
          </Button>
        ) : (
          <p className="text-xs text-slate-500">Redirecting to Google…</p>
        )}
      </div>
    </div>
  );
}

export default function OAuthStartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
          Continuing with Google…
        </div>
      }
    >
      <OAuthStartInner />
    </Suspense>
  );
}
