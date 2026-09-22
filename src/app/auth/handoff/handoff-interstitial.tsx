"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Prefetch-safe interstitial: handoff token is only consumed on Continue (POST)
 * or auto-submit after hydration. Neutral chrome — this page runs on the tenant
 * host after canonical-host auth.
 */
export function HandoffInterstitial({
  token,
  error,
}: {
  token: string;
  error?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error || !token) return;
    const id = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 50);
    return () => window.clearTimeout(id);
  }, [error, token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">
          {error ? "Couldn’t finish sign-in" : "Opening your portal…"}
        </h1>
        <p className="text-sm text-slate-600">
          {error || "One moment while we finish signing you in on this address."}
        </p>
        <form ref={formRef} method="POST" action="/auth/handoff/consume" className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full min-h-11" variant="outline">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
