import { ShareAccessInterstitial } from "./share-access-interstitial";

export const dynamic = "force-dynamic";

/**
 * Shared project access landing — GET never consumes the token (prefetch-safe).
 * POST /auth/share/consume exchanges token for a fresh Supabase session.
 */
export default async function ShareAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();
  const error = params.error ? decodeURIComponent(params.error) : null;

  if (!token) {
    return (
      <ShareAccessInterstitial
        token=""
        error={error || "Missing share link token. Request a new link from the studio."}
      />
    );
  }

  return <ShareAccessInterstitial token={token} error={error} />;
}
