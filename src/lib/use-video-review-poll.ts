"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoReviewPollResult } from "@/lib/video-review-poll-merge";

/** Visible-tab poll cadence — ~10s is responsive without hammering the API. */
export const VIDEO_REVIEW_POLL_BASE_MS = 10_000;
/** After sustained idle, back off up to once per minute. */
export const VIDEO_REVIEW_POLL_MAX_MS = 60_000;
/** No pointer/keyboard activity for this long triggers backoff. */
export const VIDEO_REVIEW_POLL_IDLE_AFTER_MS = 5 * 60_000;

export interface UseVideoReviewPollOptions {
  reviewId: string;
  versionId: string;
  since: string | null;
  enabled: boolean;
  onResult: (result: VideoReviewPollResult) => void;
  onError?: (message: string) => void;
}

export interface VideoReviewPollStats {
  requestCount: number;
  lastPollAt: string | null;
  intervalMs: number;
  visible: boolean;
}

export function useVideoReviewPoll({
  reviewId,
  versionId,
  since,
  enabled,
  onResult,
  onError,
}: UseVideoReviewPollOptions): VideoReviewPollStats {
  const sinceRef = useRef(since);
  const intervalRef = useRef(VIDEO_REVIEW_POLL_BASE_MS);
  const lastActivityRef = useRef(0);
  const requestCountRef = useRef(0);
  const lastPollAtRef = useRef<string | null>(null);
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const enabledRef = useRef(enabled);
  const versionIdRef = useRef(versionId);
  const reviewIdRef = useRef(reviewId);
  const [stats, setStats] = useState<VideoReviewPollStats>({
    requestCount: 0,
    lastPollAt: null,
    intervalMs: VIDEO_REVIEW_POLL_BASE_MS,
    visible: true,
  });

  useEffect(() => {
    sinceRef.current = since;
  }, [since]);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    versionIdRef.current = versionId;
  }, [versionId]);
  useEffect(() => {
    reviewIdRef.current = reviewId;
  }, [reviewId]);

  useEffect(() => {
    lastActivityRef.current = Date.now();

    function publishStats() {
      setStats({
        requestCount: requestCountRef.current,
        lastPollAt: lastPollAtRef.current,
        intervalMs: intervalRef.current,
        visible: visibleRef.current,
      });
    }

    function scheduleNext(delayMs: number) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void runPoll();
      }, delayMs);
    }

    async function runPoll() {
      if (!enabledRef.current || !sinceRef.current || !visibleRef.current) return;

      const idleMs = Date.now() - lastActivityRef.current;
      intervalRef.current =
        idleMs >= VIDEO_REVIEW_POLL_IDLE_AFTER_MS
          ? VIDEO_REVIEW_POLL_MAX_MS
          : VIDEO_REVIEW_POLL_BASE_MS;

      try {
        const params = new URLSearchParams({
          version_id: versionIdRef.current,
          since: sinceRef.current,
        });
        const res = await fetch(
          `/api/video-reviews/${reviewIdRef.current}/poll?${params.toString()}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!res.ok) {
          onErrorRef.current?.(data.error || "Poll failed");
          scheduleNext(intervalRef.current);
          publishStats();
          return;
        }
        requestCountRef.current += 1;
        lastPollAtRef.current = new Date().toISOString();
        sinceRef.current = data.serverTime as string;
        onResultRef.current(data as VideoReviewPollResult);
      } catch {
        onErrorRef.current?.("Poll failed");
      }

      scheduleNext(intervalRef.current);
      publishStats();
    }

    function bumpActivity() {
      lastActivityRef.current = Date.now();
      intervalRef.current = VIDEO_REVIEW_POLL_BASE_MS;
    }

    function onVisibilityChange() {
      visibleRef.current = !document.hidden;
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        publishStats();
        return;
      }
      publishStats();
      void runPoll();
    }

    window.addEventListener("pointerdown", bumpActivity);
    window.addEventListener("keydown", bumpActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (!enabled || !since) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      publishStats();
    } else {
      sinceRef.current = since;
      scheduleNext(VIDEO_REVIEW_POLL_BASE_MS);
    }

    return () => {
      window.removeEventListener("pointerdown", bumpActivity);
      window.removeEventListener("keydown", bumpActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, reviewId, versionId, since]);

  return stats;
}
