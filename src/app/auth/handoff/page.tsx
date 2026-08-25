import { HandoffInterstitial } from "./handoff-interstitial";

export const dynamic = "force-dynamic";

/**
 * Cross-origin session handoff landing.
 * GET never consumes the token (prefetch-safe). POST /auth/handoff/consume does.
 */
export default async function AuthHandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token || "").trim();
  const error = params.error?.trim() || null;

  if (!token) {
    return (
      <HandoffInterstitial
        token=""
        error={error || "Missing handoff token. Sign in again from your studio portal."}
      />
    );
  }

  return <HandoffInterstitial token={token} error={error} />;
}
