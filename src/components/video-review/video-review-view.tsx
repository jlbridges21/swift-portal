"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoReviewCommentPanel } from "@/components/video-review/video-review-comment-panel";
import { formatReviewTimestamp } from "@/lib/video-review-format";
import {
  computeVideoContentRect,
  normalizedPointToPercent,
  pointerToNormalizedPoint,
} from "@/lib/video-review-coords";
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
  versions,
  isAdmin,
  backHref,
  backLabel = "Back to project",
}: VideoReviewViewProps) {
  const searchParams = useSearchParams();
  const deepLinkVersion = searchParams.get("version");
  const deepLinkComment = searchParams.get("comment");
  const initialVersion = versions[versions.length - 1];
  const [activeVersionId, setActiveVersionId] = useState(initialVersion?.id ?? "");
  const [commentView, setCommentView] = useState<VideoReviewCommentView>("unresolved");
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
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeVersion = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? versions[versions.length - 1],
    [versions, activeVersionId]
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
    if (deepLinkVersion && versions.some((v) => v.id === deepLinkVersion)) {
      setActiveVersionId(deepLinkVersion);
    }
  }, [deepLinkVersion, versions]);

  useEffect(() => {
    void loadComments();
    setPendingPoint(null);
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

  const seekTo = useCallback((seconds: number, commentId?: string) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play().catch(() => {
      video.pause();
    });
    if (commentId) setActiveCommentId(commentId);
  }, []);

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

  const handleVideoPause = () => {
    const video = videoRef.current;
    if (!video) return;
    setPausedAt(video.currentTime);
    setPlayheadSeconds(video.currentTime);
  };

  const handleVideoPlay = () => {
    setPausedAt(null);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    setPlayheadSeconds(video.currentTime);
  };

  const handleFrameClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || video.paused === false) return;

    const rect = container.getBoundingClientRect();
    const content = computeVideoContentRect(rect.width, rect.height, video.videoWidth, video.videoHeight);
    if (!content) return;

    const point = pointerToNormalizedPoint(e.clientX, e.clientY, rect, content);
    if (!point) {
      toast.message("Tap the video frame, not the black bars.");
      return;
    }
    setPendingPoint(point);
    setPausedAt(video.currentTime);
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
      toast.success("Comment added");
      void loadComments();
    } catch {
      toast.error("Could not save comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const contentRect = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !videoDimensions.width) return null;
    return computeVideoContentRect(
      containerSize.width,
      containerSize.height,
      videoDimensions.width,
      videoDimensions.height
    );
  }, [containerSize, videoDimensions]);

  const pointStyle = useMemo(() => {
    if (!pendingPoint || !contentRect || !containerSize.width) return null;
    return normalizedPointToPercent(
      pendingPoint,
      containerSize.width,
      containerSize.height,
      contentRect
    );
  }, [pendingPoint, contentRect, containerSize]);

  const markerPointComments = useMemo(
    () => markerComments.filter((c) => c.point_x != null && c.point_y != null),
    [markerComments]
  );

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

      <div className="mb-4 flex flex-wrap gap-2">
        {versions.map((version) => (
          <Button
            key={version.id}
            type="button"
            size="sm"
            variant={version.id === activeVersion.id ? "accent" : "outline"}
            className="min-h-11"
            onClick={() => setActiveVersionId(version.id)}
            aria-pressed={version.id === activeVersion.id}
          >
            V{version.version_number}
            {version.id === versions[versions.length - 1]?.id ? " · Latest" : ""}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div
            ref={containerRef}
            className="relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-black/10"
            onClick={handleFrameClick}
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
                }}
                onTimeUpdate={handleTimeUpdate}
                aria-label={`Review video version ${activeVersion.version_number}`}
              />
            )}
            {pointStyle && (
              <span
                className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-white shadow-lg"
                style={{ left: `${pointStyle.leftPct}%`, top: `${pointStyle.topPct}%` }}
                aria-hidden
              />
            )}
            {markerPointComments
              .filter((c) => c.id !== activeCommentId)
              .map((c) => {
                if (!contentRect || !containerSize.width) return null;
                const pct = normalizedPointToPercent(
                  { x: c.point_x!, y: c.point_y! },
                  containerSize.width,
                  containerSize.height,
                  contentRect
                );
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-2 ring-accent/80"
                    style={{ left: `${pct.leftPct}%`, top: `${pct.topPct}%` }}
                    aria-label={`Comment at ${formatReviewTimestamp(c.timestamp_seconds ?? 0)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(c.timestamp_seconds ?? 0, c.id);
                    }}
                  />
                );
              })}
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
                    onClick={() => seekTo(cluster.anchorSeconds, cluster.comments[0]?.id)}
                  >
                    {count > 1 ? count : null}
                  </button>
                );
              })}
              <div className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
            </div>
          )}

          <p className="text-xs text-muted">
            Pause the video, tap the frame to mark a spot (optional), then add your comment. Timeline
            markers follow the active comment view.
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
              </div>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Pause the video and describe what you'd like changed…"
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
