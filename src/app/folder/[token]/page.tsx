import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { parseSurfaceMode } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { listSharedFolderPhotos, recordMediaShareView, resolveMediaShareToken } from "@/lib/media-shares";
import {
  allowPhotoShareRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { FolderShareViewer, PhotoShareUnavailable } from "@/components/photos/photo-share-viewer";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Shared photos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export async function generateViewport(): Promise<Viewport> {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return { themeColor: "#F8FAFC", colorScheme: "light" };
  const settings = await getAppSettings(host.businessId);
  const dark = parseSurfaceMode(settings.business.surfaceMode) === "dark";
  return { themeColor: dark ? "#14181F" : "#F8FAFC", colorScheme: dark ? "dark" : "light" };
}

/**
 * Anonymous folder gallery. The token is the only credential; a signed-in
 * session is ignored, and only the folder name and its current photos are shown —
 * never the project.
 */
export default async function FolderSharePage({ params }: PageProps) {
  const { token } = await params;
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) notFound();

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const blocked = isPhotoShareLookupBlocked(ip);
  const rate = blocked.blocked ? { allowed: false, retryAfterSec: blocked.retryAfterSec } : allowPhotoShareRequest(ip);
  if (!rate.allowed) {
    return (
      <PhotoShareBrand businessId={host.businessId}>
        <PhotoShareUnavailable rateLimitedSec={rate.retryAfterSec} />
      </PhotoShareBrand>
    );
  }

  const share = await resolveMediaShareToken(token, host.businessId);
  if (!share || share.subject.kind !== "folder") {
    recordPhotoShareMiss(ip);
    notFound();
  }

  const photos = await listSharedFolderPhotos(share.businessId, share.subject.folder);
  await recordMediaShareView(share.businessId, share.shareId);

  return (
    <PhotoShareBrand businessId={share.businessId}>
      <FolderShareViewer
        token={token}
        folderName={share.subject.folder.name}
        photos={photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
        allowDownload={share.allowDownload}
      />
    </PhotoShareBrand>
  );
}
