import { createServiceClient } from "@/lib/supabase/server";

/**
 * Best-effort egress metering for Platform Economics (migration V112).
 *
 *   proxied_download  bytes ShootPortal streamed to a viewer (exact)
 *   zip_download      source bytes packed into a streamed ZIP (exact, pre-compression)
 *   signed_delivery   a full-size signed URL handed to a browser (estimated: one file size
 *                     per issue; the browser may read less, more, or hit the CDN cache)
 *
 * Never throws and never blocks the response. A missing table/function (migration not yet
 * applied) is silently ignored.
 */
export type EgressChannel = "proxied_download" | "zip_download" | "signed_delivery";

export function recordEgress(
  businessId: string | null | undefined,
  channel: EgressChannel,
  bytes: number | null | undefined,
  opts?: { requests?: number; imageTransforms?: number }
): void {
  if (!businessId) return;
  const size = typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
  const transforms = opts?.imageTransforms ?? 0;
  if (size === 0 && transforms === 0) return;
  void (async () => {
    try {
      const raw = await createServiceClient();
      const { error } = await raw.rpc("record_business_egress", {
        p_business_id: businessId,
        p_channel: channel,
        p_bytes: size,
        p_requests: opts?.requests ?? 1,
        p_image_transforms: transforms,
      });
      if (error && !/does not exist|schema cache|Could not find the function|42883|PGRST202/i.test(error.message)) {
        console.warn("[egress-metering] record failed", { channel, message: error.message });
      }
    } catch (err) {
      console.warn("[egress-metering] record failed", err instanceof Error ? err.message : err);
    }
  })();
}
