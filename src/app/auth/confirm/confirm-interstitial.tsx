"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Prefetch-safe interstitial: token is only submitted on Continue (POST).
 * GET of this page must never call verifyOtp.
 */
export function ConfirmInterstitial({
  tokenHash,
  type,
  error,
}: {
  tokenHash: string;
  type: string;
  error?: string | null;
}) {
  const title =
    type === "invite"
      ? "Accept your invitation"
      : type === "recovery"
        ? "Continue to reset your password"
        : "Confirm your email";

  const description =
    type === "invite"
      ? "Click Continue to finish joining this studio’s portal. This step confirms it was you, not an email scanner."
      : type === "recovery"
        ? "Click Continue to securely open the password reset form. This protects your link from being used by automatic scanners."
        : "Click Continue to confirm your email and open your portal.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">
            ShootPortal
          </p>
          <CardTitle className="mt-2 text-slate-900">{title}</CardTitle>
          <CardDescription className="text-slate-600">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <form method="POST" action="/auth/confirm/verify" className="space-y-3">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <Button
              type="submit"
              className="w-full min-h-11 bg-[#4F46E5] text-white hover:bg-[#4338CA]"
            >
              Continue
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            Your one-time link is not used until you click Continue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
