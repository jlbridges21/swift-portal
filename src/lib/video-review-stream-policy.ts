import { THUMB_SIGNED_TTL_SECONDS } from "@/lib/media-signed-thumbs";
import { SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS } from "@/lib/use-video-review-stream";

export function signedUrlRefreshAtSeconds(
  ttlSeconds = THUMB_SIGNED_TTL_SECONDS,
  refreshBeforeSeconds = SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS
): number {
  return ttlSeconds - refreshBeforeSeconds;
}

/** True when a proactive refresh should run before the signed URL expires. */
export function shouldRefreshSignedUrl(
  issuedAtMs: number,
  nowMs: number,
  ttlSeconds = THUMB_SIGNED_TTL_SECONDS,
  refreshBeforeSeconds = SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS
): boolean {
  const elapsedSec = (nowMs - issuedAtMs) / 1000;
  return elapsedSec >= signedUrlRefreshAtSeconds(ttlSeconds, refreshBeforeSeconds);
}

/** True when the signed URL has passed its TTL (mid-playback expiry recovery). */
export function signedUrlExpired(
  issuedAtMs: number,
  nowMs: number,
  ttlSeconds = THUMB_SIGNED_TTL_SECONDS
): boolean {
  return (nowMs - issuedAtMs) / 1000 >= ttlSeconds;
}

export interface PlaybackRestoreState {
  time: number;
  wasPlaying: boolean;
}

export function capturePlaybackRestoreState(
  currentTime: number,
  paused: boolean
): PlaybackRestoreState {
  return { time: currentTime, wasPlaying: !paused };
}
