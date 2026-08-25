"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Prefetch-safe interstitial: handoff token is only consumed on Continue (POST).
 * GET of this page must never call consumeSessionHandoff.
 */
export function HandoffInterstitial({
  token,
  error,
}: {
  token: string;
  error?: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">
            ShootPortal
          </p>
          <CardTitle className="mt-2 text-slate-900">Continue to your portal</CardTitle>
          <CardDescription className="text-slate-600">
            Click Continue to finish signing in on this studio&apos;s portal. This step confirms it
            was you, not an automated prefetch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <form method="POST" action="/auth/handoff/consume" className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <Button
              type="submit"
              className="w-full min-h-11 bg-[#4F46E5] text-white hover:bg-[#4338CA]"
            >
              Continue
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            Your sign-in is not applied on this host until you click Continue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
