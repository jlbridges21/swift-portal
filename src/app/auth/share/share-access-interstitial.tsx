"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Prefetch-safe interstitial — token consumed only on Continue (POST). */
export function ShareAccessInterstitial({
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
          <CardTitle className="mt-2 text-slate-900">Open shared project</CardTitle>
          <CardDescription className="text-slate-600">
            Click Continue to sign in and view the project. This link works on any device until it
            expires or is revoked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {token ? (
            <form method="POST" action="/auth/share/consume" className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <Button
                type="submit"
                className="w-full min-h-11 bg-[#4F46E5] text-white hover:bg-[#4338CA]"
              >
                Continue
              </Button>
            </form>
          ) : null}
          <p className="mt-4 text-center text-xs text-slate-500">
            Your session is not created until you click Continue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
