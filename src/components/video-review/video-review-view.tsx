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
import { VideoReviewShell } from "@/components/video-review/video-review-shell";
import { VideoReviewTimelineMarker } from "@/components/video-review/video-review-timeline-marker";
import { VideoReviewVersionBar } from "@/components/video-review/video-review-version-bar";
import { formatReviewTimestamp } from "@/lib/video-review-format";
import {
  computeVideoContentRect,
  normalizedPointToPercent,
} from "@/lib/video-review-coords";
import {
  resolveVideoSurfaceClick,
  resolveVisibleDot,
  shouldDeferToNativeVideoControls,
} from "@/lib/video-review-player-interaction";
import { markerPositionPercent } from "@/lib/video-review-timeline";
import {
  clusterEnrichedReviewComments,
} from "@/lib/video-review-timeline-markers";
import { useVideoReviewStream } from "@/lib/use-video-review-stream";
import { useVideoReviewPoll } from "@/lib/use-video-review-poll";
import {
  mergeCommentStore,
  mergeVersionRows,
  populateCommentStore,
  snapshotFromCommentStore,
  type VideoReviewPollResult,
} from "@/lib/video-review-poll-merge";
import type { VideoReview } from "@/lib/types";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import type {
  VideoReviewCommentCounts,
  VideoReviewCommentEnriched,
  VideoReviewCommentThread,
  VideoReviewCommentView,
} from "@/lib/video-review-comment-model";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VideoReviewViewProps {
  projectId: string;
  reviewId: string;
  review: VideoReview;
  versions: VideoReviewVersionRow[];
  isAdmin: boolean;
  currentUserId: string;
  backHref: string;
  backLabel?: string;
}

export function VideoReviewView({
  projectId,
  reviewId,
  review,
  versions: initialVersions,
  isAdmin,
  currentUserId,
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
  const [composerTimestamp, setComposerTimestamp] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingMark, setSavingMark] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverPreviewPoint, setHoverPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [markingMode, setMarkingMode] = useState(false);
  const [editMarkMode, setEditMarkMode] = useState(false);
  const [editMarkCommentId, setEditMarkCommentId] = useState<string | null>(null);
  const [videoPaused, setVideoPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentStoreRef = useRef<Map<string, VideoReviewCommentEnriched>>(new Map());
  const commentViewRef = useRef(commentView);
  const blockPlaybackRef = useRef(false);

  useEffect(() => {
    commentViewRef.current = commentView;
  }, [commentView]);

  const [pollSince, setPollSince] = useState<string | null>(null);

  useEffect(() => {
    setVersionRows(initialVersions);
  }, [initialVersions]);

  const activeVersion = useMemo(
    () => versionRows.find((v) => v.id === activeVersionId) ?? latestVersion,
    [versionRows, activeVersionId, latestVersion]
  );

  const mediaAssetId = activeVersion?.media_asset_id ?? null;
  const { url, loading, error, refresh, registerVideo } = useVideoReviewStream(mediaAssetId, true);

  const applyStoreSnapshot = useCallback(
    (store: Map<string, VideoReviewCommentEnriched>, nextCounts: VideoReviewCommentCounts) => {
      const snap = snapshotFromCommentStore(store, commentViewRef.current);
      setThreads(snap.threads);
      setMarkerComments(snap.markerComments);
      setCounts(nextCounts);
    },
    []
  );

  const loadComments = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!activeVersionId) return;
      if (!options?.quiet) {
        setCommentsLoading(true);
      }
      setCommentsError(null);
      try {
        const res = await fetch(
          `/api/video-reviews/${reviewId}/comments?version_id=${activeVersionId}&view=all`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!res.ok) {
          setCommentsError(data.error || "Could not load comments.");
          if (!options?.quiet) {
            setThreads([]);
            setMarkerComments([]);
          }
          return;
        }
        const store = populateCommentStore(data.threads ?? [], data.markerComments ?? []);
        commentStoreRef.current = store;
        applyStoreSnapshot(store, data.counts ?? { all: 0, unresolved: 0, resolved: 0 });
        setPollSince(new Date().toISOString());
      } catch {
        setCommentsError("Could not load comments.");
        if (!options?.quiet) {
          setThreads([]);
          setMarkerComments([]);
        }
      } finally {
        if (!options?.quiet) {
          setCommentsLoading(false);
        }
      }
    },
    [reviewId, activeVersionId, applyStoreSnapshot]
  );

  const handlePollResult = useCallback(
    (result: VideoReviewPollResult) => {
      if (!result.changes.length && !result.versions.length) {
        setCounts(result.counts);
        setPollSince(result.serverTime);
        return;
      }
      commentStoreRef.current = mergeCommentStore(commentStoreRef.current, result.changes);
      applyStoreSnapshot(commentStoreRef.current, result.counts);
      if (result.versions.length) {
        setVersionRows((prev) => mergeVersionRows(prev, result.versions));
      }
      setPollSince(result.serverTime);
    },
    [applyStoreSnapshot]
  );

  useVideoReviewPoll({
    reviewId,
    versionId: activeVersionId,
    since: pollSince,
    enabled: Boolean(activeVersionId && pollSince && !commentsLoading),
    onResult: handlePollResult,
  });

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
    setEditMarkMode(false);
    setEditMarkCommentId(null);
    setComposerTimestamp(null);
    setCommentText("");
    setPausedAt(null);
    setPollSince(null);
    commentStoreRef.current = new Map();
    if (!deepLinkComment) {
      setActiveCommentId(null);
    }
  }, [reviewId, activeVersionId, deepLinkComment, loadComments]);

  useEffect(() => {
    if (commentStoreRef.current.size === 0) return;
    const snap = snapshotFromCommentStore(commentStoreRef.current, commentView);
    setThreads(snap.threads);
    setMarkerComments(snap.markerComments);
  }, [commentView]);

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

  const activeComment = useMemo(() => {
    if (!activeCommentId) return null;
    for (const thread of threads) {
      if (thread.comment.id === activeCommentId) return thread.comment;
    }
    return markerComments.find((c) => c.id === activeCommentId) ?? null;
  }, [activeCommentId, threads, markerComments]);

  const blockPlaybackToggle =
    pendingPoint !== null ||
    markingMode ||
    editMarkMode ||
    commentText.trim().length > 0;

  useEffect(() => {
    blockPlaybackRef.current = blockPlaybackToggle;
  }, [blockPlaybackToggle]);

  const canEditMark = Boolean(
    activeComment &&
      activeComment.author_user_id === currentUserId &&
      activeComment.point_x != null &&
      activeComment.point_y != null &&
      !pendingPoint &&
      !markingMode &&
      !editMarkMode
  );

  const visibleDot = useMemo(() => {
    let activeCommentPoint: { x: number; y: number } | null = null;
    if (activeCommentId && !editMarkMode) {
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
      markingMode,
      editMarkMode,
      hoverPreviewPoint,
    });
  }, [
    videoPaused,
    pendingPoint,
    activeCommentId,
    markerComments,
    threads,
    markingMode,
    editMarkMode,
    hoverPreviewPoint,
  ]);

  const dotStyle = useMemo(() => {
    const point = visibleDot ? { x: visibleDot.x, y: visibleDot.y } : null;
    if (!point || !contentRect || !containerSize.width) return null;
    return normalizedPointToPercent(point, containerSize.width, containerSize.height, contentRect);
  }, [visibleDot, contentRect, containerSize]);

  const clusters = useMemo(
    () => clusterEnrichedReviewComments(markerComments),
    [markerComments]
  );

  const composerDisplayTime = composerTimestamp ?? pausedAt ?? playheadSeconds;

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
      setComposerTimestamp(seconds);
      setActiveCommentId(commentId ?? null);
      setMarkingMode(false);
      setEditMarkMode(false);
      setEditMarkCommentId(null);
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
    setEditMarkMode(false);
    setEditMarkCommentId(null);
    setHoverPreviewPoint(null);
  }, []);

  const enterMarkingMode = useCallback(() => {
    setEditMarkMode(false);
    setEditMarkCommentId(null);
    setMarkingMode((active) => {
      if (active) {
        setHoverPreviewPoint(null);
        return false;
      }
      pauseVideo();
      setComposerTimestamp((prev) => prev ?? videoRef.current?.currentTime ?? playheadSeconds);
      return true;
    });
  }, [pauseVideo, playheadSeconds]);

  const enterEditMarkMode = useCallback(() => {
    if (!activeCommentId || !canEditMark) return;
    pauseVideo();
    setMarkingMode(false);
    setPendingPoint(null);
    setEditMarkCommentId(activeCommentId);
    setEditMarkMode(true);
    setHoverPreviewPoint(null);
  }, [activeCommentId, canEditMark, pauseVideo]);

  const saveEditMark = useCallback(
    async (point: { x: number; y: number }) => {
      if (!editMarkCommentId) return;
      setSavingMark(true);
      try {
        const res = await fetch(
          `/api/video-reviews/${reviewId}/comments/${editMarkCommentId}/mark`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ point_x: point.x, point_y: point.y }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Could not update mark.");
          return;
        }
        commentStoreRef.current = mergeCommentStore(commentStoreRef.current, [data]);
        applyStoreSnapshot(commentStoreRef.current, counts);
        setEditMarkMode(false);
        setEditMarkCommentId(null);
        setHoverPreviewPoint(null);
        toast.success("Mark updated");
      } catch {
        toast.error("Could not update mark.");
      } finally {
        setSavingMark(false);
      }
    },
    [reviewId, editMarkCommentId, applyStoreSnapshot, counts]
  );

  const handleMarkButtonClick = useCallback(() => {
    if (canEditMark) {
      enterEditMarkMode();
      return;
    }
    enterMarkingMode();
  }, [canEditMark, enterEditMarkMode, enterMarkingMode]);

  const handleCommentInputChange = useCallback(
    (value: string) => {
      const video = videoRef.current;
      if (value.length > 0 && commentText.length === 0 && video && !video.paused) {
        const captured = video.currentTime;
        video.pause();
        setComposerTimestamp(captured);
        setPausedAt(captured);
        setPlayheadSeconds(captured);
      }
      setCommentText(value);
    },
    [commentText.length]
  );

  const handleSurfacePointer = useCallback(
    (clientX: number, clientY: number) => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || !contentRect) return;

      const rect = container.getBoundingClientRect();
      if (shouldDeferToNativeVideoControls(rect.height, clientY, rect.top)) {
        return;
      }

      const result = resolveVideoSurfaceClick({
        markingMode,
        editMarkMode,
        videoPaused,
        hasDraftPoint: pendingPoint !== null,
        blockPlaybackToggle,
        clientX,
        clientY,
        containerRect: rect,
        content: contentRect,
      });

      if (result.action === "letterbox") {
        toast.message("Tap the video frame, not the black bars.");
        return;
      }

      if (result.action === "blocked_draft") {
        toast.message("Clear your mark or finish your comment before playing.");
        return;
      }

      if (result.action === "move_edit_mark") {
        void saveEditMark(result.point);
        return;
      }

      if (result.action === "place_mark" || result.action === "move_draft") {
        setPendingPoint(result.point);
        pauseVideo();
        setMarkingMode(false);
        setHoverPreviewPoint(null);
        setComposerTimestamp((prev) => prev ?? video.currentTime);
        return;
      }

      togglePlayPause();
    },
    [
      markingMode,
      editMarkMode,
      videoPaused,
      pendingPoint,
      blockPlaybackToggle,
      contentRect,
      pauseVideo,
      togglePlayPause,
      saveEditMark,
    ]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "Escape" && (markingMode || editMarkMode)) {
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
  }, [markingMode, editMarkMode, exitMarkingMode, togglePlayPause]);

  const handleVideoPause = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoPaused(true);
    setPausedAt(video.currentTime);
    setPlayheadSeconds(video.currentTime);
  };

  const handleVideoPlay = () => {
    if (blockPlaybackRef.current) {
      videoRef.current?.pause();
      toast.message("Clear your mark or finish your comment before playing.");
      return;
    }
    setVideoPaused(false);
    setPausedAt(null);
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
    const timestamp = composerTimestamp ?? pausedAt ?? video?.currentTime ?? 0;
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
      setComposerTimestamp(null);
      exitMarkingMode();
      toast.success("Comment added");
      void loadComments({ quiet: true });
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
    <VideoReviewShell
      header={
        <>
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
        </>
      }
      main={
        <>
          <div
            ref={containerRef}
            className={cn(
              "relative aspect-video w-full min-h-0 overflow-hidden rounded-2xl bg-black ring-1 ring-black/10 lg:min-h-0 lg:flex-1 lg:aspect-auto",
              (markingMode || editMarkMode) && "ring-2 ring-accent/70"
            )}
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
            {url && !loading && !error && (
              <div
                className={cn(
                  "absolute inset-x-0 top-0 bottom-12 z-10",
                  markingMode || editMarkMode ? "cursor-crosshair" : "cursor-pointer"
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  handleSurfacePointer(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  if ((!markingMode && !editMarkMode) || !videoPaused || !contentRect || !containerRef.current) {
                    setHoverPreviewPoint(null);
                    return;
                  }
                  const rect = containerRef.current.getBoundingClientRect();
                  const result = resolveVideoSurfaceClick({
                    markingMode,
                    editMarkMode,
                    videoPaused: true,
                    hasDraftPoint: false,
                    blockPlaybackToggle: false,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    containerRect: rect,
                    content: contentRect,
                  });
                  if (result.action === "place_mark" || result.action === "move_edit_mark") {
                    setHoverPreviewPoint(result.point);
                  } else {
                    setHoverPreviewPoint(null);
                  }
                }}
                onMouseLeave={() => setHoverPreviewPoint(null)}
                role="presentation"
                aria-hidden
              />
            )}
            {dotStyle && visibleDot && (
              <span
                className={cn(
                  "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-2 ring-white",
                  visibleDot.kind === "preview" && "h-3 w-3 bg-accent/60",
                  visibleDot.kind === "draft" && "h-3.5 w-3.5 bg-accent sm:h-4 sm:w-4",
                  visibleDot.kind === "selected" && "h-3.5 w-3.5 bg-white ring-accent sm:h-4 sm:w-4"
                )}
                style={{ left: `${dotStyle.leftPct}%`, top: `${dotStyle.topPct}%` }}
                aria-hidden
              />
            )}
            {(markingMode || editMarkMode) && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                {editMarkMode ? "Edit mark" : "Marking mode"}
              </div>
            )}
          </div>

          {duration > 0 && (
            <div
              className="relative h-11 shrink-0 rounded-lg bg-slate-100 px-1"
              role="group"
              aria-label={`Comment timeline · ${commentView} view`}
            >
              {clusters.map((cluster) => (
                <VideoReviewTimelineMarker
                  key={`${cluster.anchorSeconds}-${cluster.comments[0]?.id}`}
                  cluster={cluster}
                  leftPct={markerPositionPercent(cluster.anchorSeconds, duration)}
                  onActivate={(activeCluster) => {
                    setActiveCommentId(activeCluster.comments[0]?.id ?? null);
                    seekTo(activeCluster.anchorSeconds, activeCluster.comments[0]?.id);
                  }}
                />
              ))}
              <div className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
            </div>
          )}

          <form
            onSubmit={handleSubmitComment}
            className="shrink-0 space-y-2 rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40 ring-1 ring-black/5"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>
                At{" "}
                <strong className="text-primary">{formatReviewTimestamp(composerDisplayTime)}</strong>
                {composerTimestamp != null && (
                  <span className="ml-1 text-[10px] text-muted">(locked when typing started)</span>
                )}
              </span>
              {pendingPoint && (
                <span className="inline-flex items-center gap-1 text-accent">
                  <MapPin className="h-3 w-3" /> Point marked
                </span>
              )}
              {(canEditMark || !activeComment?.point_x) && (
                <Button
                  type="button"
                  size="sm"
                  variant={markingMode || editMarkMode ? "accent" : "outline"}
                  className={cn("min-h-9", (markingMode || editMarkMode) && "cursor-crosshair")}
                  onClick={handleMarkButtonClick}
                  aria-pressed={markingMode || editMarkMode}
                  disabled={savingMark || Boolean(activeComment?.point_x && !canEditMark)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {editMarkMode ? "Editing mark…" : canEditMark ? "Edit mark" : "Add mark"}
                </Button>
              )}
            </div>
            <Textarea
              value={commentText}
              onChange={(e) => handleCommentInputChange(e.target.value)}
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
        </>
      }
      rail={
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
          onCommentsChange={() => void loadComments({ quiet: true })}
          onSelectComment={setActiveCommentId}
        />
      }
    />
  );
}
