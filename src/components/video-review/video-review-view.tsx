"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoReviewCommentPanel } from "@/components/video-review/video-review-comment-panel";
import { VideoReviewVersionBar } from "@/components/video-review/video-review-version-bar";
import { formatReviewTimestamp } from "@/lib/video-review-format";
import {
  computeVideoContentRect,
  normalizedPointToPercent,
} from "@/lib/video-review-coords";
import {
  resolveVideoSurfaceClick,
  resolveVisibleDot,
} from "@/lib/video-review-player-interaction";
import { clusterReviewComments, markerPositionPercent } from "@/lib/video-review-timeline";
import { useVideoReviewStream } from "@/lib/use-video-review-stream";
import type { VideoReview } from "@/lib/types";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import type {
  VideoReviewCommentCounts,
  VideoReviewCommentEnriched,
  VideoReviewCommentThread,
  VideoReviewCommentView,
} from "@/lib/video-review-comments";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VideoReviewViewProps {
  projectId: string;
  reviewId: string;
  review: VideoReview;
  versions: VideoReviewVersionRow[];
  isAdmin: boolean;
  backHref: string;
  backLabel?: string;
}

export function VideoReviewView({
  projectId,
  reviewId,
  review,
  versions: initialVersions,
  isAdmin,
  backHref,
  backLabel = "Back to project",
}: VideoReviewViewProps) {
  const searchParams = useSearchParams();
  const deepLinkVersion = searchParams.get("version");
  const deepLinkComment = searchParams.get("comment");

  const [versionRows, setVersionRows] = useState(initialVersions);
  const latestVersion = versionRows[versionRows.length - 1];
  const [activeVersionId, setActiveVersionId] = useState(latestVersion?.id ?? "");
  const [commentView, setCommentView] = useState<VideoReviewCommentView>("all");
  const [threads, setThreads] = useState<VideoReviewCommentThread[]>([]);
  const [markerComments, setMarkerComments] = useState<VideoReviewCommentEnriched[]>([]);
  const [counts, setCounts] = useState<VideoReviewCommentCounts>({
    all: 0,
    unresolved: 0,
    resolved: 0,
  });
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverPreviewPoint, setHoverPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [markingMode, setMarkingMode] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVersionRows(initialVersions);
  }, [initialVersions]);

  const activeVersion = useMemo(
    () => versionRows.find((v) => v.id === activeVersionId) ?? latestVersion,
    [versionRows, activeVersionId, latestVersion]
  );

  const mediaAssetId = activeVersion?.media_asset_id ?? null;
  const { url, loading, error, refresh, registerVideo } = useVideoReviewStream(mediaAssetId, true);

  const loadComments = useCallback(async () => {
    if (!activeVersionId) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(
        `/api/video-reviews/${reviewId}/comments?version_id=${activeVersionId}&view=${commentView}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) {
        setCommentsError(data.error || "Could not load comments.");
        setThreads([]);
        setMarkerComments([]);
        return;
      }
      setThreads(data.threads ?? []);
      setMarkerComments(data.markerComments ?? []);
      setCounts(data.counts ?? { all: 0, unresolved: 0, resolved: 0 });
    } catch {
      setCommentsError("Could not load comments.");
      setThreads([]);
      setMarkerComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [reviewId, activeVersionId, commentView]);

  useEffect(() => {
    if (deepLinkVersion && versionRows.some((v) => v.id === deepLinkVersion)) {
      setActiveVersionId(deepLinkVersion);
    }
  }, [deepLinkVersion, versionRows]);

  useEffect(() => {
    void loadComments();
    setPendingPoint(null);
    setHoverPreviewPoint(null);
    setMarkingMode(false);
    setPausedAt(null);
    if (!deepLinkComment) {
      setActiveCommentId(null);
    }
  }, [loadComments, deepLinkComment]);

  useEffect(() => {
    if (deepLinkComment) {
      setActiveCommentId(deepLinkComment);
    }
  }, [deepLinkComment]);

  useEffect(() => {
    registerVideo(videoRef.current);
  }, [registerVideo, url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [url]);

  const contentRect = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !videoDimensions.width) return null;
    return computeVideoContentRect(
      containerSize.width,
      containerSize.height,
      videoDimensions.width,
      videoDimensions.height
    );
  }, [containerSize, videoDimensions]);

  const visibleDot = useMemo(() => {
    let activeCommentPoint: { x: number; y: number } | null = null;
    if (activeCommentId) {
      const fromMarker = markerComments.find((c) => c.id === activeCommentId);
      if (fromMarker?.point_x != null && fromMarker.point_y != null) {
        activeCommentPoint = { x: fromMarker.point_x, y: fromMarker.point_y };
      } else {
        for (const thread of threads) {
          if (
            thread.comment.id === activeCommentId &&
            thread.comment.point_x != null &&
            thread.comment.point_y != null
          ) {
            activeCommentPoint = { x: thread.comment.point_x, y: thread.comment.point_y };
            break;
          }
        }
      }
    }
    return resolveVisibleDot({
      videoPaused,
      pendingPoint,
      activeCommentId,
      activeCommentPoint,
    });
  }, [videoPaused, pendingPoint, activeCommentId, markerComments, threads]);

  const previewDot = markingMode && videoPaused ? hoverPreviewPoint : null;

  const dotStyle = useMemo(() => {
    const point = previewDot ?? (visibleDot ? { x: visibleDot.x, y: visibleDot.y } : null);
    if (!point || !contentRect || !containerSize.width) return null;
    return normalizedPointToPercent(point, containerSize.width, containerSize.height, contentRect);
  }, [previewDot, visibleDot, contentRect, containerSize]);

  const clusters = useMemo(
    () =>
      clusterReviewComments(
        markerComments.map((c) => ({
          ...c,
          timestamp_seconds: c.timestamp_seconds ?? 0,
        }))
      ),
    [markerComments]
  );

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPausedAt(video.currentTime);
    setPlayheadSeconds(video.currentTime);
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => video.pause());
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback(
    (seconds: number, commentId?: string) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = seconds;
      setPausedAt(seconds);
      setPlayheadSeconds(seconds);
      setActiveCommentId(commentId ?? null);
      setMarkingMode(false);
      setHoverPreviewPoint(null);
    },
    []
  );

  useEffect(() => {
    if (!deepLinkComment || commentsLoading || threads.length === 0) return;
    const thread = threads.find((t) => t.comment.id === deepLinkComment);
    if (thread?.comment.timestamp_seconds != null) {
      seekTo(thread.comment.timestamp_seconds, deepLinkComment);
    }
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-comment-id="${deepLinkComment}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [deepLinkComment, commentsLoading, threads, seekTo]);

  const exitMarkingMode = useCallback(() => {
    setMarkingMode(false);
    setHoverPreviewPoint(null);
  }, []);

  const enterMarkingMode = useCallback(() => {
    setMarkingMode((active) => {
      if (active) {
        setHoverPreviewPoint(null);
        return false;
      }
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
      return true;
    });
  }, []);

  const handleSurfacePointer = useCallback(
    (clientX: number, clientY: number) => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || !contentRect) return;

      const rect = container.getBoundingClientRect();
      const result = resolveVideoSurfaceClick({
        markingMode,
        videoPaused,
        hasDraftPoint: pendingPoint !== null,
        clientX,
        clientY,
        containerRect: rect,
        content: contentRect,
      });

      if (result.action === "letterbox") {
        toast.message("Tap the video frame, not the black bars.");
        return;
      }

      if (result.action === "place_mark" || result.action === "move_draft") {
        setPendingPoint(result.point);
        pauseVideo();
        setMarkingMode(false);
        setHoverPreviewPoint(null);
        return;
      }

      togglePlayPause();
    },
    [markingMode, videoPaused, pendingPoint, contentRect, pauseVideo, togglePlayPause]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "Escape" && markingMode) {
        e.preventDefault();
        exitMarkingMode();
        return;
      }

      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayPause();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [markingMode, exitMarkingMode, togglePlayPause]);

  const handleVideoPause = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoPaused(true);
    setPausedAt(video.currentTime);
    setPlayheadSeconds(video.currentTime);
  };

  const handleVideoPlay = () => {
    setVideoPaused(false);
    setPausedAt(null);
    setActiveCommentId(null);
    setHoverPreviewPoint(null);
    exitMarkingMode();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    setPlayheadSeconds(video.currentTime);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const video = videoRef.current;
    const timestamp = pausedAt ?? video?.currentTime ?? 0;
    const body = commentText.trim();
    if (!body) {
      toast.error("Write a comment first.");
      return;
    }
    if (!activeVersion?.id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/video-reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          version_id: activeVersion.id,
          body,
          timestamp_seconds: timestamp,
          point_x: pendingPoint?.x ?? null,
          point_y: pendingPoint?.y ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save comment.");
        return;
      }
      setCommentText("");
      setPendingPoint(null);
      exitMarkingMode();
      toast.success("Comment added");
      void loadComments();
    } catch {
      toast.error("Could not save comment.");
    } finally {
      setSubmitting(false);
    }
  };

  function handleVersionAdded(version: VideoReviewVersionRow) {
    setVersionRows((prev) => {
      const next = [...prev.filter((v) => v.id !== version.id), version].sort(
        (a, b) => a.version_number - b.version_number
      );
      return next;
    });
    setActiveVersionId(version.id);
  }

  if (!activeVersion) {
    return (
      <EmptyState
        icon={MessageSquarePlus}
        title="No versions yet"
        description="Upload a video version to start this review."
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 pb-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-primary sm:text-2xl">{review.title}</h1>
          <p className="text-sm text-muted">Video review · {isAdmin ? "Admin" : "Client"} view</p>
        </div>
      </div>

      <VideoReviewVersionBar
        reviewId={reviewId}
        projectId={projectId}
        versions={versionRows}
        activeVersionId={activeVersionId}
        onVersionChange={setActiveVersionId}
        onVersionAdded={handleVersionAdded}
        isAdmin={isAdmin}
      />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div
            ref={containerRef}
            className={cn(
              "relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-black/10",
              markingMode && "cursor-crosshair ring-2 ring-accent/70"
            )}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              handleSurfacePointer(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (!markingMode || !videoPaused || !contentRect || !containerRef.current) {
                setHoverPreviewPoint(null);
                return;
              }
              const rect = containerRef.current.getBoundingClientRect();
              const result = resolveVideoSurfaceClick({
                markingMode: true,
                videoPaused: true,
                hasDraftPoint: false,
                clientX: e.clientX,
                clientY: e.clientY,
                containerRect: rect,
                content: contentRect,
              });
              if (result.action === "place_mark") {
                setHoverPreviewPoint(result.point);
              } else {
                setHoverPreviewPoint(null);
              }
            }}
            onMouseLeave={() => setHoverPreviewPoint(null)}
            role="presentation"
          >
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
                <p className="text-sm">{error}</p>
                <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void refresh()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}
            {url && (
              <video
                ref={videoRef}
                key={url}
                src={url}
                controls
                playsInline
                className="h-full w-full object-contain"
                onPause={handleVideoPause}
                onPlay={handleVideoPlay}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration);
                  setVideoDimensions({
                    width: e.currentTarget.videoWidth,
                    height: e.currentTarget.videoHeight,
                  });
                  setVideoPaused(e.currentTarget.paused);
                }}
                onTimeUpdate={handleTimeUpdate}
                aria-label={`Review video version ${activeVersion.version_number}`}
              />
            )}
            {dotStyle && (visibleDot || previewDot) && (
              <span
                className={cn(
                  "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-2 ring-white",
                  previewDot ? "h-3 w-3 bg-accent/60" : "h-3.5 w-3.5 bg-accent sm:h-4 sm:w-4",
                  visibleDot?.kind === "selected" && "h-3.5 w-3.5 bg-white ring-accent sm:h-4 sm:w-4"
                )}
                style={{ left: `${dotStyle.leftPct}%`, top: `${dotStyle.topPct}%` }}
                aria-hidden
              />
            )}
            {markingMode && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                Marking mode
              </div>
            )}
          </div>

          {duration > 0 && (
            <div
              className="relative h-10 rounded-lg bg-slate-100 px-1"
              role="group"
              aria-label={`Comment timeline · ${commentView} view`}
            >
              {clusters.map((cluster) => {
                const pct = markerPositionPercent(cluster.anchorSeconds, duration);
                const count = cluster.comments.length;
                return (
                  <button
                    key={`${cluster.anchorSeconds}-${cluster.comments[0]?.id}`}
                    type="button"
                    className={cn(
                      "absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      count > 1 ? "h-6 min-w-6 px-1" : "h-4 w-4"
                    )}
                    style={{ left: `${pct}%` }}
                    aria-label={
                      count > 1
                        ? `${count} comments at ${formatReviewTimestamp(cluster.anchorSeconds)}`
                        : `Comment at ${formatReviewTimestamp(cluster.anchorSeconds)}`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(cluster.anchorSeconds, cluster.comments[0]?.id);
                    }}
                  >
                    {count > 1 ? count : null}
                  </button>
                );
              })}
              <div className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
            </div>
          )}

          <p className="text-xs text-muted">
            Click the video to play or pause. Use <strong>Add mark</strong> to pin a spot on a paused
            frame (optional). Comments belong to V{activeVersion.version_number} only.
          </p>
        </div>

        <VideoReviewCommentPanel
          reviewId={reviewId}
          versionNumber={activeVersion.version_number}
          isAdmin={isAdmin}
          view={commentView}
          counts={counts}
          threads={threads}
          loading={commentsLoading}
          error={commentsError}
          activeCommentId={activeCommentId}
          onViewChange={setCommentView}
          onRetry={() => void loadComments()}
          onSeek={seekTo}
          onCommentsChange={() => void loadComments()}
          newCommentForm={
            <form onSubmit={handleSubmitComment} className="mb-4 space-y-2 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  At{" "}
                  <strong className="text-primary">
                    {formatReviewTimestamp(pausedAt ?? playheadSeconds)}
                  </strong>
                </span>
                {pendingPoint && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <MapPin className="h-3 w-3" /> Point marked
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={markingMode ? "accent" : "outline"}
                  className={cn("min-h-9", markingMode && "cursor-crosshair")}
                  onClick={enterMarkingMode}
                  aria-pressed={markingMode}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Add mark
                </Button>
              </div>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Describe what you'd like changed at this moment…"
                rows={3}
                className="min-h-[88px] resize-y"
                disabled={submitting}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="accent" size="sm" className="min-h-11" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add comment"}
                </Button>
                {pendingPoint && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setPendingPoint(null)}
                  >
                    Clear point
                  </Button>
                )}
              </div>
            </form>
          }
        />
      </div>
    </div>
  );
}
