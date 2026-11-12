import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { parseSurfaceMode } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getSharedItem, listSharedLibraryFolderItems, SHARED_FOLDER_MAX_ITEMS } from "@/lib/library-folder-shares";
import { recordMediaShareView, resolveMediaShareToken } from "@/lib/media-shares";
import {
  allowPhotoShareRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { PhotoShareUnavailable } from "@/components/photos/photo-share-viewer";
import { LibraryFolderShareViewer, SharedItemViewer } from "@/components/photos/shared-media-viewer";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Shared media",
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
 * Anonymous viewer for a shared Media Library folder or a single shared item (video, file,
 * 360° tour, 3D model). The token is the only credential; a signed-in session is ignored,
 * and nothing about projects or clients is shown. Folder contents are evaluated live.
 */
export default async function SharedMediaPage({ params }: PageProps) {
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
  if (!share || (share.subject.kind !== "library_folder" && share.subject.kind !== "item")) {
    recordPhotoShareMiss(ip);
    notFound();
  }

  if (share.subject.kind === "item") {
    const item = await getSharedItem(share);
    if (!item) notFound();
    await recordMediaShareView(share.businessId, share.shareId);
    return (
      <PhotoShareBrand businessId={share.businessId}>
        <SharedItemViewer token={token} item={item} />
      </PhotoShareBrand>
    );
  }

  const items = await listSharedLibraryFolderItems(share);
  await recordMediaShareView(share.businessId, share.shareId);

  return (
    <PhotoShareBrand businessId={share.businessId}>
      <LibraryFolderShareViewer
        token={token}
        folderName={share.subject.libraryFolder.name}
        items={items}
        allowDownload={share.allowDownload}
        truncated={items.length >= SHARED_FOLDER_MAX_ITEMS}
      />
    </PhotoShareBrand>
  );
}
