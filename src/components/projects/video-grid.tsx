"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Clapperboard, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeAreaCloseButton } from "@/components/ui/safe-area-close-button";
import { VideoCard, VIDEO_GRID_CLASS, VIDEO_GRID_COLUMNS } from "@/components/ui/video-card";
import { VideoPosterSurface } from "@/components/ui/video-poster-surface";
import { createThumbRequestQueue } from "@/lib/media-thumb-client";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import { videoDurationBadge } from "@/lib/video-duration";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type VideoGridEntry = {
  video: MediaAsset;
  kind: "uploaded" | "youtube";
};

export type VideoGridProps = {
  entries: VideoGridEntry[];
  projectId: string;
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  reviewByAssetId: Map<string, VideoReviewListItem>;
  /** Base path prefix for review links, e.g. `/dashboard/projects` or `/admin/projects`. */
  reviewPathPrefix: string;
  downloadsAllowed?: boolean;
  onDownload?: (video: MediaAsset) => void;
  /** Admin-only: show Start video review in player when no review exists. */
  isAdmin?: boolean;
  /** Collapse to this many full grid rows (column count follows the breakpoint) with a "View N more" toggle. */
  compactRows?: number;
  /** Public link visitors without a session: review links prompt sign-in. Omit when authenticated. */
  signInHref?: string;
  /** Show review entry on cards and in player (authenticated viewers with review access). */
  canAccessVideoReviews?: boolean;
  /** Full POST URL for batch thumbnails (public link pages). */
  thumbnailsEndpoint?: string;
  /** Admin: full card chrome (controls + review). Replaces default VideoCard + renderBelowCard. */
  renderAdminCard?: (
    entry: VideoGridEntry,
    index: number,
    openPlayer: () => void,
    thumbUrl?: string | null
  ) => ReactNode;
  /** @deprecated Prefer renderAdminCard for admin layouts. */
  renderBelowCard?: (entry: VideoGridEntry, index: number) => ReactNode;
};

export function VideoGrid({
  entries,
  projectId,
  getDownloadUrl,
  reviewByAssetId,
  reviewPathPrefix,
  downloadsAllowed = true,
  onDownload,
  isAdmin = false,
  compactRows,
  signInHref,
  canAccessVideoReviews = false,
  thumbnailsEndpoint,
  renderAdminCard,
  renderBelowCard,
}: VideoGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const onThumbUrls = useCallback((urls: Record<string, string>) => {
    setThumbUrls((prev) => ({ ...prev, ...urls }));
  }, []);
  const thumbQueue = useMemo(
    () => createThumbRequestQueue(onThumbUrls, { endpoint: thumbnailsEndpoint }),
    [onThumbUrls, thumbnailsEndpoint]
  );

  useEffect(() => () => thumbQueue.reset(), [thumbQueue]);

  const loadThumb = useCallback(
    (video: MediaAsset) => {
      if (video.media_source === "youtube") return;
      thumbQueue.request(video.id);
    },
    [thumbQueue]
  );

  useEffect(() => {
    entries.forEach(({ video }) => loadThumb(video));
  }, [entries, loadThumb]);

  if (!entries.length) return null;

  const renderCard = (entry: VideoGridEntry, index: number, className?: string) => {
    const openPlayer = () => openPlayerAt(index);
    const reviewItem = reviewByAssetId.get(entry.video.id) ?? null;
    const reviewHref = buildReviewHref({
      mediaAssetId: entry.video.id,
      reviewItem,
      projectId,
      reviewPathPrefix,
      signInHref,
      isAdmin,
      canAccessVideoReviews,
    });
    if (renderAdminCard) {
      return (
        <div key={entry.video.id} className={cn("min-w-0", className)}>
          {renderAdminCard(entry, index, openPlayer, thumbUrls[entry.video.id])}
        </div>
      );
    }
    return (
      <div key={entry.video.id} className={cn("min-w-0", className)}>
        <VideoCard
          video={entry.video}
          thumbUrl={thumbUrls[entry.video.id]}
          onClick={openPlayer}
        />
        {canAccessVideoReviews || signInHref ? (
          <VideoReviewCardEntry reviewHref={reviewHref} reviewItem={reviewItem} />
        ) : null}
        {renderBelowCard?.(entry, index)}
      </div>
    );
  };

  function openPlayerAt(index: number) {
    setActiveIndex(index);
  }

  return (
    <>
      {compactRows != null && entries.length > compactRows * VIDEO_GRID_COLUMNS.base ? (
        <CollapsibleVideoRows entries={entries} rows={compactRows} renderCard={renderCard} />
      ) : (
        <div className={VIDEO_GRID_CLASS}>
          {entries.map((entry, index) => renderCard(entry, index))}
        </div>
      )}

      {activeIndex !== null && (
        <VideoPlayerLightbox
          entries={entries}
          currentIndex={activeIndex}
          projectId={projectId}
          getDownloadUrl={getDownloadUrl}
          reviewByAssetId={reviewByAssetId}
          reviewPathPrefix={reviewPathPrefix}
          thumbUrls={thumbUrls}
          downloadsAllowed={downloadsAllowed}
          onDownload={onDownload}
          isAdmin={isAdmin}
          signInHref={signInHref}
          canAccessVideoReviews={canAccessVideoReviews}
          onClose={() => setActiveIndex(null)}
          onNavigate={setActiveIndex}
          onLoadThumb={loadThumb}
        />
      )}
    </>
  );
}

function moreVideosLabel(n: number) {
  return `View ${n} more ${n === 1 ? "video" : "videos"}`;
}

/**
 * Collapsed state shows exactly `rows` full rows at every breakpoint. Visibility is
 * pure CSS (mirrors VIDEO_GRID_CLASS columns), so SSR and hydration match with no flash.
 */
function CollapsibleVideoRows({
  entries,
  rows,
  renderCard,
}: {
  entries: VideoGridEntry[];
  rows: number;
  renderCard: (entry: VideoGridEntry, index: number, className?: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCount = rows * VIDEO_GRID_COLUMNS.base;
  const xlCount = rows * VIDEO_GRID_COLUMNS.xl;
  const baseRemaining = entries.length - baseCount;
  const xlRemaining = Math.max(0, entries.length - xlCount);
  const visible = expanded ? entries : entries.slice(0, xlCount);

  function toggle() {
    if (expanded) {
      const top = containerRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) containerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    setExpanded((v) => !v);
  }

  return (
    <div ref={containerRef} className="scroll-mt-24 space-y-4">
      <div className={VIDEO_GRID_CLASS}>
        {visible.map((entry, index) =>
          renderCard(entry, index, !expanded && index >= baseCount ? "hidden xl:block" : undefined)
        )}
      </div>
      {baseRemaining > 0 ? (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full min-h-11", xlRemaining === 0 && "xl:hidden")}
          aria-expanded={expanded}
          onClick={toggle}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show fewer videos
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span className="xl:hidden">{moreVideosLabel(baseRemaining)}</span>
              {xlRemaining > 0 ? (
                <span className="hidden xl:inline">{moreVideosLabel(xlRemaining)}</span>
              ) : null}
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

function buildReviewHref({
  mediaAssetId,
  reviewItem,
  projectId,
  reviewPathPrefix,
  signInHref,
  isAdmin,
  canAccessVideoReviews,
}: {
  mediaAssetId: string;
  reviewItem: VideoReviewListItem | null;
  projectId: string;
  reviewPathPrefix: string;
  signInHref?: string;
  isAdmin?: boolean;
  canAccessVideoReviews?: boolean;
}): string | null {
  if (canAccessVideoReviews || isAdmin) {
    if (reviewItem) {
      return `${reviewPathPrefix}/${projectId}/reviews/${reviewItem.review.id}`;
    }
    return `${reviewPathPrefix}/${projectId}/reviews/asset/${mediaAssetId}`;
  }
  if (signInHref && !isAdmin) return signInHref;
  return null;
}

function VideoReviewCardEntry({
  reviewHref,
  reviewItem,
}: {
  reviewHref: string | null;
  reviewItem: VideoReviewListItem | null;
}) {
  if (!reviewHref) return null;
  const isSignIn = reviewHref.startsWith("/login");
  const label = isSignIn ? "Sign in to comment" : reviewItem ? "Open review" : "Add comment";
  return (
    <div className="mt-2">
      <Button variant="outline" size="sm" className="min-h-10 w-full sm:w-auto" asChild>
        <Link href={reviewHref}>
          <Clapperboard className="mr-1.5 h-4 w-4" />
          {label}
        </Link>
      </Button>
    </div>
  );
}

function VideoPlayerLightbox({
  entries,
  currentIndex,
  projectId,
  getDownloadUrl,
  reviewByAssetId,
  reviewPathPrefix,
  thumbUrls,
  downloadsAllowed,
  onDownload,
  isAdmin,
  signInHref,
  canAccessVideoReviews = false,
  onClose,
  onNavigate,
  onLoadThumb,
}: {
  entries: VideoGridEntry[];
  currentIndex: number;
  projectId: string;
  getDownloadUrl: VideoGridProps["getDownloadUrl"];
  reviewByAssetId: Map<string, VideoReviewListItem>;
  reviewPathPrefix: string;
  thumbUrls: Record<string, string>;
  downloadsAllowed?: boolean;
  onDownload?: (video: MediaAsset) => void;
  isAdmin?: boolean;
  signInHref?: string;
  canAccessVideoReviews?: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onLoadThumb: (video: MediaAsset) => void;
}) {
  const router = useRouter();
  const entry = entries[currentIndex];
  const video = entry.video;
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [creatingReview, setCreatingReview] = useState(false);
  const reviewItem = reviewByAssetId.get(video.id) ?? null;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    entries.forEach(({ video: v }) => onLoadThumb(v));
  }, [entries, onLoadThumb]);

  useEffect(() => {
    setStreamUrl(null);
    if (entry.kind === "youtube") return;

    let cancelled = false;
    setLoadingStream(true);
    void getDownloadUrl(video).then((url) => {
      if (!cancelled) {
        setStreamUrl(url);
        setLoadingStream(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entry.kind, video, getDownloadUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function startReview() {
    if (!isAdmin || reviewItem) return;
    setCreatingReview(true);
    try {
      const res = await fetch("/api/video-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          media_asset_id: video.id,
          title: mediaDisplayName(video),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not create review.");
        return;
      }
      toast.success("Video review created");
      router.push(`${reviewPathPrefix}/${projectId}/reviews/${data.review.id}`);
    } finally {
      setCreatingReview(false);
    }
  }

  const reviewHref = buildReviewHref({
    mediaAssetId: video.id,
    reviewItem,
    projectId,
    reviewPathPrefix,
    signInHref,
    isAdmin,
    canAccessVideoReviews,
  });

  const embedUrl =
    entry.kind === "youtube" && video.embed_url
      ? `${video.embed_url}${video.embed_url.includes("?") ? "&" : "?"}autoplay=1`
      : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black lg:flex-row"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <SafeAreaCloseButton onClick={onClose} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex shrink-0 items-center px-4 pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
        >
          <h2 className="min-w-0 truncate pr-14 text-sm font-medium text-white/90">
            {mediaDisplayName(video)}
          </h2>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4">
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black">
            {entry.kind === "youtube" && embedUrl ? (
              <iframe
                key={video.id}
                src={embedUrl}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={mediaDisplayName(video)}
              />
            ) : loadingStream ? (
              <div className="flex h-full items-center justify-center text-white/70">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : streamUrl ? (
              <video
                key={video.id}
                src={streamUrl}
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/60">
                Could not load video
              </div>
            )}
          </div>

          <div className="mt-4 flex w-full max-w-5xl flex-wrap items-center gap-2">
            {reviewHref ? (
              <Button variant="accent" size="sm" className="min-h-10" asChild>
                <Link href={reviewHref}>
                  <Clapperboard className="mr-1.5 h-4 w-4" />
                  {reviewHref.startsWith("/login")
                    ? "Sign in to comment"
                    : reviewItem
                      ? "Open review"
                      : "Add comment"}
                </Link>
              </Button>
            ) : isAdmin && entry.kind === "uploaded" && !reviewItem ? (
              <Button
                type="button"
                variant="accent"
                size="sm"
                className="min-h-10"
                disabled={creatingReview}
                onClick={() => void startReview()}
              >
                {creatingReview ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Clapperboard className="mr-1.5 h-4 w-4" />
                )}
                Start video review
              </Button>
            ) : null}

            {downloadsAllowed && onDownload && entry.kind === "uploaded" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => onDownload(video)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="max-h-[40vh] shrink-0 overflow-y-auto border-t border-white/10 bg-black/95 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
        <p className="sticky top-0 z-10 border-b border-white/10 bg-black/95 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/50">
          More videos
        </p>
        <ul className="divide-y divide-white/5">
          {entries.map((item, index) => {
            const active = index === currentIndex;
            const duration = videoDurationBadge(item.video);
            return (
              <li key={item.video.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(index)}
                  className={cn(
                    "flex w-full gap-3 px-3 py-3 text-left transition hover:bg-white/5",
                    active && "bg-white/10 ring-1 ring-inset ring-white/20"
                  )}
                >
                  <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-md bg-slate-900 sm:w-40">
                    <VideoPosterSurface
                      asset={item.video}
                      thumbUrl={thumbUrls[item.video.id]}
                      compact
                      className="absolute inset-0"
                    />
                    {duration ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[10px] font-semibold text-white">
                        {duration}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p
                      className={cn(
                        "line-clamp-2 text-sm leading-snug",
                        active ? "font-semibold text-white" : "text-white/80"
                      )}
                    >
                      {mediaDisplayName(item.video)}
                    </p>
                    {active ? (
                      <p className="mt-1 text-xs font-medium text-accent">Now playing</p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

/** Preserve project display_order (do not split YouTube vs upload). */
export function videosToGridEntries(videos: MediaAsset[]): VideoGridEntry[] {
  return videos.map((video) => ({
    video,
    kind: video.media_source === "youtube" ? "youtube" : "uploaded",
  }));
}

/** @deprecated Prefer videosToGridEntries to preserve display order. */
export function buildVideoGridEntries(
  youtubeVideos: MediaAsset[],
  uploadedVideos: MediaAsset[]
): VideoGridEntry[] {
  return videosToGridEntries([...youtubeVideos, ...uploadedVideos]);
}
