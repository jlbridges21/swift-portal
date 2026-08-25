"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { isOAuthAllowedOnCurrentHost } from "@/lib/oauth-origins";
import { getPlatformRootDomain } from "@/lib/site-metadata";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.8.6-2.5 1.9C4.9 19.5 8.2 21.6 12 21.6c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z"
      />
      <path
        fill="#4A90E2"
        d="M3.3 7.2C2.5 8.7 2 10.3 2 12s.5 3.3 1.3 4.8l3.3-2.5C6.2 13.4 6 12.7 6 12s.2-1.4.6-2.3L3.3 7.2z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.5 14.7 1.5 12 1.5 8.2 1.5 4.9 3.6 3.3 7.2l3.3 2.5C7 7.3 9.2 5.4 12 5.4z"
      />
    </svg>
  );
}

/**
 * Google OAuth button. Hidden when the current host is not an allowlisted OAuth
 * origin (custom domains missing from NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS).
 * Password sign-in remains available.
 *
 * Never starts OAuth on the bare apex (shootportal.app) — navigates to www first
 * so the PKCE verifier cookie and /auth/callback stay on the same host.
 */
export function GoogleSignInButton({
  label = "Continue with Google",
  nextPath = "/auth/callback",
  disabled,
  allowed: allowedProp,
}: {
  label?: string;
  /** Path appended to current origin for redirectTo (must be allowlisted). */
  nextPath?: string;
  disabled?: boolean;
  /** Server-computed allowlist result (preferred; avoids silent client build-time miss). */
  allowed?: boolean;
}) {
  const [allowed, setAllowed] = useState(allowedProp ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof allowedProp === "boolean") {
      setAllowed(allowedProp);
      return;
    }
    setAllowed(isOAuthAllowedOnCurrentHost());
  }, [allowedProp]);

  if (!allowed) return null;

  async function onClick() {
    setLoading(true);
    setError("");

    const host = window.location.hostname.toLowerCase();
    const root = getPlatformRootDomain().toLowerCase();
    // Never begin OAuth on bare apex — Vercel 308 mid-flow would drop the PKCE cookie.
    if (host === root) {
      const www = new URL(window.location.href);
      www.hostname = `www.${root}`;
      window.location.assign(www.toString());
      return;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}${nextPath.startsWith("/") ? nextPath : `/${nextPath}`}`;
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
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full min-h-11 gap-2"
        disabled={disabled || loading}
        onClick={() => void onClick()}
      >
        <GoogleMark className="h-4 w-4" />
        {loading ? "Redirecting..." : label}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-card px-2 text-muted">{label}</span>
      </div>
    </div>
  );
}
