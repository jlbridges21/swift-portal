"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Prefetch-safe interstitial: token is only submitted on Continue (POST) or
 * auto-submit after hydration (email scanners do not run this JS).
 * Neutral chrome when returning to a tenant portal — no ShootPortal flash.
 */
export function ConfirmInterstitial({
  tokenHash,
  type,
  next,
  returnTo,
  error,
}: {
  tokenHash: string;
  type: string;
  next?: string | null;
  returnTo?: string | null;
  error?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const whiteLabel = Boolean(returnTo);

  useEffect(() => {
    if (error || !tokenHash) return;
    const id = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 50);
    return () => window.clearTimeout(id);
  }, [error, tokenHash]);

  const title =
    type === "invite"
      ? "Accept your invitation"
      : type === "recovery"
        ? "Continue to reset your password"
        : "Confirm your email";

  const description = whiteLabel
    ? "Opening your portal…"
    : type === "invite"
      ? "Click Continue to finish joining this studio’s portal. This step confirms it was you, not an email scanner."
      : type === "recovery"
        ? "Click Continue to securely open the password reset form. This protects your link from being used by automatic scanners."
        : "Click Continue to confirm your email and open your portal.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {!whiteLabel ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            ShootPortal
          </p>
        ) : null}
        <h1 className="text-lg font-semibold text-slate-900">{error ? "Couldn’t continue" : title}</h1>
        <p className="text-sm text-slate-600">{error || description}</p>
        <form ref={formRef} method="POST" action="/auth/confirm/verify" className="space-y-3">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
          <Button type="submit" className="w-full min-h-11" variant={whiteLabel ? "outline" : "default"}>
            {whiteLabel ? "Continue to portal" : "Continue"}
          </Button>
        </form>
        {!whiteLabel ? (
          <p className="text-xs text-slate-500">
            Your one-time link is not used until you continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}
