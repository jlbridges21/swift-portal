import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { clientIp } from "@/lib/public-link-api";
import { SHARE_SECURITY_HEADERS, shareDeny, streamPreview } from "@/lib/media-share-preview";
import {
  allowPhotoShareAssetRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { resolveMediaShareToken, resolveSharedPhoto } from "@/lib/media-shares";
import { serveMediaFileDownload } from "@/lib/serve-media-file-download";
import { trackMediaDownload } from "@/lib/media-library";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "project-media";
const PREVIEW_EDGE = 2048;
const THUMB_EDGE = 640;
const SECURITY_HEADERS = SHARE_SECURITY_HEADERS;
const deny = shareDeny;

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(request);

  const blocked = isPhotoShareLookupBlocked(ip);
  if (blocked.blocked) return deny(429, "Too many requests. Please try again later.", blocked.retryAfterSec);
  const rate = allowPhotoShareAssetRequest(ip);
  if (!rate.allowed) return deny(429, "Too many requests. Please try again later.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return deny(404, "Not found.");

  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share) {
    recordPhotoShareMiss(ip);
    return deny(404, "Not found.");
  }

  // Folder shares name the photo; it must be in the folder at this moment.
  const url = new URL(request.url);
  const photo = await resolveSharedPhoto(share, url.searchParams.get("photo"));
  if (!photo) return deny(404, "Not found.");

  const variant = url.searchParams.get("variant") ?? "preview";

  if (variant === "preview") return streamPreview(photo, share.businessId, PREVIEW_EDGE);
  if (variant === "thumb") return streamPreview(photo, share.businessId, THUMB_EDGE);

  if (variant === "original") {
    if (!share.allowDownload) return deny(403, "Downloads aren't enabled for this photo.");
    const db = await createTenantServiceClient(share.businessId);
    const res = await serveMediaFileDownload({
      storage: db.raw,
      bucket: BUCKET,
      asset: photo,
      searchParams: url.searchParams,
      meterBusinessId: share.businessId,
      onSuccess: () => {
        void trackMediaDownload({
          businessId: share.businessId,
          mediaAssetId: photo.id,
          email: share.email,
          ipAddress: ip,
        });
      },
    });
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(key, value);
    return res;
  }

  return deny(400, "Unknown variant.");
}
