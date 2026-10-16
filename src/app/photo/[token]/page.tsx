import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { parseSurfaceMode } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { recordMediaShareView, resolveMediaShareToken } from "@/lib/media-shares";
import {
  allowPhotoShareRequest,
  isPhotoShareLookupBlocked,
  recordPhotoShareMiss,
} from "@/lib/public-link-rate-limit";
import { PhotoShareUnavailable, PhotoShareViewer } from "@/components/photos/photo-share-viewer";
import { PhotoShareBrand } from "./brand";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Shared photo",
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
 * Anonymous single-photo viewer. The token is the only credential; a signed-in
 * session is ignored (no redirects), and nothing about the project is shown.
 */
export default async function PhotoSharePage({ params }: PageProps) {
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
  if (!share || share.subject.kind !== "photo") {
    recordPhotoShareMiss(ip);
    notFound();
  }

  await recordMediaShareView(share.businessId, share.shareId);

  return (
    <PhotoShareBrand businessId={share.businessId}>
      <PhotoShareViewer token={token} allowDownload={share.allowDownload} />
    </PhotoShareBrand>
  );
}
