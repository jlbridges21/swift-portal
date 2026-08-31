"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isCommentIntersectingContainer,
  isCommentIdInThreads,
} from "@/lib/video-review-playback-follow";
import type { VideoReviewCommentThread } from "@/lib/video-review-comment-model";

interface UseVideoReviewPlaybackFollowOptions {
  playbackFollowCommentId: string | null;
  visibleThreads: VideoReviewCommentThread[];
  videoPaused: boolean;
  composerFocused: boolean;
  /** lg+ only — below lg the list is in page flow; auto-scroll is disabled entirely. */
  enabledByBreakpoint: boolean;
}

export function useVideoReviewPlaybackFollow({
  playbackFollowCommentId,
  visibleThreads,
  videoPaused,
  composerFocused,
  enabledByBreakpoint,
}: UseVideoReviewPlaybackFollowOptions) {
  const listRef = useRef<HTMLDivElement>(null);
  const [followEnabled, setFollowEnabled] = useState(true);
  const [autoFollowPaused, setAutoFollowPaused] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const programmaticScrollRef = useRef(false);
  const scrollEndTimerRef = useRef<number | null>(null);

  const visibleInTab = useCallback(
    (commentId: string | null) => isCommentIdInThreads(commentId, visibleThreads),
    [visibleThreads]
  );

  const scrollToComment = useCallback((commentId: string) => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`);
    if (!el) return;

    programmaticScrollRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    if (scrollEndTimerRef.current != null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      scrollEndTimerRef.current = null;
    }, 700);
  }, []);

  const resumeFollow = useCallback(() => {
    setAutoFollowPaused(false);
    if (
      enabledByBreakpoint &&
      followEnabled &&
      !videoPaused &&
      playbackFollowCommentId &&
      visibleInTab(playbackFollowCommentId)
    ) {
      scrollToComment(playbackFollowCommentId);
    }
  }, [
    enabledByBreakpoint,
    followEnabled,
    videoPaused,
    playbackFollowCommentId,
    visibleInTab,
    scrollToComment,
  ]);

  const shouldAutoScroll =
    enabledByBreakpoint &&
    followEnabled &&
    !autoFollowPaused &&
    !videoPaused &&
    !composerFocused &&
    !replyFocused &&
    Boolean(playbackFollowCommentId) &&
    visibleInTab(playbackFollowCommentId);

  const lastAutoScrolledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldAutoScroll || !playbackFollowCommentId) return;
    if (lastAutoScrolledIdRef.current === playbackFollowCommentId) return;

    scrollToComment(playbackFollowCommentId);
    lastAutoScrolledIdRef.current = playbackFollowCommentId;
  }, [shouldAutoScroll, playbackFollowCommentId, scrollToComment]);

  useEffect(() => {
    if (videoPaused || autoFollowPaused || !followEnabled) {
      lastAutoScrolledIdRef.current = null;
    }
  }, [videoPaused, autoFollowPaused, followEnabled]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const onScroll = () => {
      if (programmaticScrollRef.current) return;

      setAutoFollowPaused(true);

      if (!followEnabled || !playbackFollowCommentId || !visibleInTab(playbackFollowCommentId)) {
        return;
      }

      const el = container.querySelector<HTMLElement>(
        `[data-comment-id="${playbackFollowCommentId}"]`
      );
      if (el && isCommentIntersectingContainer(container, el)) {
        setAutoFollowPaused(false);
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [followEnabled, playbackFollowCommentId, visibleInTab]);

  const showJumpToCurrent =
    enabledByBreakpoint &&
    followEnabled &&
    autoFollowPaused &&
    !videoPaused &&
    Boolean(playbackFollowCommentId) &&
    visibleInTab(playbackFollowCommentId);

  const highlightCommentId =
    enabledByBreakpoint && followEnabled && playbackFollowCommentId && visibleInTab(playbackFollowCommentId)
      ? playbackFollowCommentId
      : null;

  return {
    listRef,
    followEnabled,
    setFollowEnabled,
    autoFollowPaused,
    resumeFollow,
    showJumpToCurrent,
    highlightCommentId,
    onReplyFocus: () => setReplyFocused(true),
    onReplyBlur: () => {
      requestAnimationFrame(() => {
        const root = listRef.current;
        const active = document.activeElement;
        if (root?.contains(active) && active instanceof HTMLTextAreaElement) {
          return;
        }
        setReplyFocused(false);
      });
    },
  };
}
