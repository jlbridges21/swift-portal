import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { surfaceChrome } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getSharedFolderView, getSharedItem, SHARED_FOLDER_MAX_ITEMS } from "@/lib/library-folder-shares";
import { recordMediaShareView, resolveMediaShareToken } from "@/lib/media-shares";
import {
  allowPhotoShareRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { PhotoShareUnavailable } from "@/components/photos/photo-share-viewer";
import { SharedItemViewer } from "@/components/photos/shared-media-viewer";
import { LibraryFolderShareViewer } from "@/components/photos/shared-folder-view";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  /** folder: a subfolder of the shared folder (v136). */
  searchParams: Promise<{ folder?: string }>;
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
  return surfaceChrome(settings.business);
}

/**
 * Anonymous viewer for a shared Media Library folder or a single shared item (video, file,
 * 360° tour, 3D model). The token is the only credential; a signed-in session is ignored,
 * and nothing about projects or clients is shown. Folder contents are evaluated live.
 */
export default async function SharedMediaPage({ params, searchParams }: PageProps) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
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

  const requested = typeof sp.folder === "string" && sp.folder ? sp.folder : null;
  const view = await getSharedFolderView(share, requested);
  if (!view) notFound();
  // Count one view per visit, not one per subfolder opened.
  if (!requested) await recordMediaShareView(share.businessId, share.shareId);
  const { items } = view;

  return (
    <PhotoShareBrand businessId={share.businessId}>
      <LibraryFolderShareViewer
        key={view.folder.id}
        token={token}
        folderName={view.folder.name}
        folderId={requested ? view.folder.id : null}
        trail={view.trail}
        subfolders={view.subfolders}
        items={items}
        cover={view.cover}
        totalItems={view.totalItems}
        allowDownload={share.allowDownload}
        allowUpload={share.allowUpload}
        allowCreateFolders={share.allowUpload && view.nested}
        truncated={items.length >= SHARED_FOLDER_MAX_ITEMS}
      />
    </PhotoShareBrand>
  );
}
