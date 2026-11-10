import type { Metadata, Viewport } from "next";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";
import { PublicVideoWatch, PublicVideoWatchUnavailable } from "@/components/video-share/public-video-watch";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { loadPublicVideoPage } from "@/lib/public-video-page";
import { getPublicVideoSource, resolvePublicVideo } from "@/lib/video-public-shares";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ publicId: string }>;
}

export const viewport: Viewport = { themeColor: "#0B0D10", colorScheme: "dark" };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const base: Metadata = { title: "Video", robots: { index: false, follow: false } };
  const { publicId } = await params;
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return base;
  const resolved = await resolvePublicVideo(publicId, host.businessId);
  if (!resolved) return base;
  const source = await getPublicVideoSource(resolved);
  const images = source?.poster ? [{ url: source.poster }] : undefined;
  return {
    ...base,
    title: resolved.title,
    openGraph: { type: "video.other", title: resolved.title, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: resolved.title, images: images?.map((i) => i.url) },
  };
}

/**
 * Public watch page for one shared video. No sign-in, no project context: just the
 * business's brand, the player, and the video's title.
 */
export default async function PublicVideoWatchPage({ params }: PageProps) {
  const { publicId } = await params;
  const data = await loadPublicVideoPage(publicId, "view");

  if (data.status !== "ok") {
    const body = (
      <PublicVideoWatchUnavailable rateLimitedSec={data.status === "rate_limited" ? data.retryAfterSec : undefined} />
    );
    return data.businessId ? <PhotoShareBrand businessId={data.businessId}>{body}</PhotoShareBrand> : body;
  }

  return (
    <PhotoShareBrand businessId={data.resolved.businessId}>
      <PublicVideoWatch
        publicId={data.resolved.publicId}
        apiBase={data.apiBase}
        initialSource={data.source}
        title={data.resolved.title}
        width={data.resolved.video.width}
        height={data.resolved.video.height}
        customLogoUrl={data.customLogoUrl}
      />
    </PhotoShareBrand>
  );
}
