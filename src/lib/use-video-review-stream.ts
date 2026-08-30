"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  shouldRefreshSignedUrl,
  signedUrlRefreshAtSeconds,
} from "@/lib/video-review-stream-policy";

/** Refresh signed URLs this many seconds before the 7200s TTL expires. */
export const SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS = 600;

export { signedUrlRefreshAtSeconds, shouldRefreshSignedUrl };

export function useVideoReviewStream(mediaAssetId: string | null, preview = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issuedAtRef = useRef<number | null>(null);
  const pendingRestoreRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const registerVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const fetchUrl = useCallback(async (): Promise<string | null> => {
    if (!mediaAssetId) return null;
    setLoading(true);
    setError(null);
    try {
      const qs = preview ? "?preview=1" : "";
      const res = await fetch(`/api/media/download/${mediaAssetId}${qs}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(
          res.status === 403
            ? "Downloads unlock after final payment."
            : (data.error as string) || "Could not load video preview."
        );
        setUrl(null);
        return null;
      }
      issuedAtRef.current = Date.now();
      setUrl(data.url as string);
      return data.url as string;
    } catch {
      setError("Could not load video preview.");
      setUrl(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [mediaAssetId, preview]);

  const refresh = useCallback(async () => {
    const video = videoRef.current;
    if (video) {
      pendingRestoreRef.current = { time: video.currentTime, wasPlaying: !video.paused };
    }
    await fetchUrl();
  }, [fetchUrl]);

  useEffect(() => {
    void fetchUrl();
  }, [fetchUrl]);

  useEffect(() => {
    if (!mediaAssetId || !url) return;
    const interval = window.setInterval(() => {
      const issuedAt = issuedAtRef.current;
      if (!issuedAt) return;
      if (shouldRefreshSignedUrl(issuedAt, Date.now())) {
        void refresh();
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [mediaAssetId, url, refresh]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const restore = () => {
      const saved = pendingRestoreRef.current;
      if (!saved) return;
      video.currentTime = saved.time;
      if (saved.wasPlaying) {
        void video.play().catch(() => {});
      }
      pendingRestoreRef.current = null;
    };

    video.addEventListener("loadedmetadata", restore);
    const onError = () => {
      void refresh();
    };
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", restore);
      video.removeEventListener("error", onError);
    };
  }, [url, refresh]);

  return { url, loading, error, refresh, registerVideo };
}
