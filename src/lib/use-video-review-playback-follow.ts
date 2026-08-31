"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isCommentIntersectingContainer,
  isCommentIdInThreads,
} from "@/lib/video-review-playback-follow";
import {
  readFollowPlaybackPreference,
  writeFollowPlaybackPreference,
} from "@/lib/video-review-playback-follow-preference";
import {
  scrollCommentInContainer,
  type CommentScrollAlign,
} from "@/lib/video-review-comment-scroll";
import type { VideoReviewCommentThread } from "@/lib/video-review-comment-model";

export type ScrollCommentFn = (commentId: string, align: CommentScrollAlign) => void;

interface UseVideoReviewPlaybackFollowOptions {
  playbackFollowCommentId: string | null;
  visibleThreads: VideoReviewCommentThread[];
  videoPaused: boolean;
  composerFocused: boolean;
  /** lg+ only — below lg the list is in page flow; auto-scroll is disabled entirely. */
  enabledByBreakpoint: boolean;
  onRegisterScrollComment?: (fn: ScrollCommentFn) => void;
}

export function useVideoReviewPlaybackFollow({
  playbackFollowCommentId,
  visibleThreads,
  videoPaused,
  composerFocused,
  enabledByBreakpoint,
  onRegisterScrollComment,
}: UseVideoReviewPlaybackFollowOptions) {
  const listRef = useRef<HTMLDivElement>(null);
  const [followEnabled, setFollowEnabledState] = useState(true);
  const [autoFollowPaused, setAutoFollowPaused] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const programmaticScrollRef = useRef(false);
  const scrollEndTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setFollowEnabledState(readFollowPlaybackPreference());
  }, []);

  const visibleInTab = useCallback(
    (commentId: string | null) => isCommentIdInThreads(commentId, visibleThreads),
    [visibleThreads]
  );

  const beginProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = true;
    if (scrollEndTimerRef.current != null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      scrollEndTimerRef.current = null;
    }, 700);
  }, []);

  const scrollCommentToPosition = useCallback(
    (commentId: string, align: CommentScrollAlign) => {
      const container = listRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`);
      if (!el) return;

      beginProgrammaticScroll();
      scrollCommentInContainer(container, el, align, "smooth");
    },
    [beginProgrammaticScroll]
  );

  useEffect(() => {
    onRegisterScrollComment?.(scrollCommentToPosition);
  }, [onRegisterScrollComment, scrollCommentToPosition]);

  const setFollowEnabled = useCallback(
    (value: boolean) => {
      setFollowEnabledState(value);
      writeFollowPlaybackPreference(value);
      if (!value) return;
      setAutoFollowPaused(false);
      if (
        enabledByBreakpoint &&
        !videoPaused &&
        playbackFollowCommentId &&
        visibleInTab(playbackFollowCommentId)
      ) {
        scrollCommentToPosition(playbackFollowCommentId, "center");
      }
    },
    [
      enabledByBreakpoint,
      videoPaused,
      playbackFollowCommentId,
      visibleInTab,
      scrollCommentToPosition,
    ]
  );

  const resumeFollow = useCallback(() => {
    setAutoFollowPaused(false);
    if (
      enabledByBreakpoint &&
      followEnabled &&
      !videoPaused &&
      playbackFollowCommentId &&
      visibleInTab(playbackFollowCommentId)
    ) {
      scrollCommentToPosition(playbackFollowCommentId, "center");
    }
  }, [
    enabledByBreakpoint,
    followEnabled,
    videoPaused,
    playbackFollowCommentId,
    visibleInTab,
    scrollCommentToPosition,
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

    scrollCommentToPosition(playbackFollowCommentId, "center");
    lastAutoScrolledIdRef.current = playbackFollowCommentId;
  }, [shouldAutoScroll, playbackFollowCommentId, scrollCommentToPosition]);

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

  /** Shown only when follow is ON but the user manually detached by scrolling the list. */
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
    scrollCommentToPosition,
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
