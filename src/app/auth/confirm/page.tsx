import Link from "next/link";
import { AuthLinkHelpCard } from "@/components/auth/auth-link-help-card";
import { ConfirmInterstitial } from "./confirm-interstitial";
import { isEmailOtpType, safeAuthNext } from "@/lib/auth-confirm";

export const dynamic = "force-dynamic";

/**
 * GET only — renders Continue interstitial. Must NEVER call verifyOtp.
 * Prefetchers and email scanners issue GETs; the token must survive until
 * POST /auth/confirm/verify.
 */
export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHashRaw = params.token_hash;
  const typeRaw = params.type;
  const errorRaw = params.error;
  const nextRaw = params.next;
  const tokenHash = typeof tokenHashRaw === "string" ? tokenHashRaw : "";
  const type = typeof typeRaw === "string" ? typeRaw : "";
  const error = typeof errorRaw === "string" ? errorRaw : null;
  const next =
    typeof nextRaw === "string" ? safeAuthNext(nextRaw) : null;

  if (!tokenHash || !isEmailOtpType(type)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] px-4">
        <AuthLinkHelpCard
          errorKind={error === "access_denied" ? "access_denied" : "otp_expired"}
          description={
            error === "missing"
              ? "That confirmation link is incomplete. Request a new one below."
              : null
          }
        />
        <Link href="/login" className="text-sm text-[#4F46E5] underline underline-offset-2">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <ConfirmInterstitial
      tokenHash={tokenHash}
      type={type}
      next={next}
      error={
        error === "otp_expired"
          ? "That link was already used or expired. You can request a new one from the sign-in page."
          : error === "verify_failed"
            ? "We couldn’t verify that link. Try Continue again, or request a new link."
            : null
      }
    />
  );
}
