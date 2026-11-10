import type { Metadata, Viewport } from "next";
import { PublicVideoPlayer } from "@/components/video-share/public-video-player";
import { loadPublicVideoPage } from "@/lib/public-video-page";
import { parseEmbedQuery } from "@/lib/video-embed-options";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Video",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

/**
 * Iframe player for external websites. Chrome-free: just the video and the overlays the
 * embed options ask for. Renders inside any site (no frame restrictions) and never shows
 * project, client, or account information.
 */
export default async function EmbedVideoPage({ params, searchParams }: PageProps) {
  const [{ publicId }, query] = await Promise.all([params, searchParams]);
  const preview = query.preview === "1";
  const options = parseEmbedQuery(query);
  const data = await loadPublicVideoPage(publicId, "embed_view", { preview });

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {data.status === "ok" ? (
        <PublicVideoPlayer
          publicId={data.resolved.publicId}
          apiBase={data.apiBase}
          initialSource={data.source}
          title={data.resolved.title}
          options={options}
          preview={preview}
          branding={{
            name: data.brand.name,
            logoUrl: data.customLogoUrl,
            href: `${data.apiBase}/v/${encodeURIComponent(data.resolved.publicId)}`,
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-950 px-6 text-center text-white">
          <div>
            <p className="text-sm font-medium">
              {data.status === "rate_limited" ? "Too many requests" : "This video isn't available"}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {data.status === "rate_limited"
                ? "Please try again in a moment."
                : "It may have been removed or is no longer shared."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
