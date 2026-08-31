const SESSION_KEY = "video-review-follow-playback";

function getSessionStorage(): Storage | null {
  try {
    return (globalThis as typeof globalThis & { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Session-persisted follow-playback preference (default on). */
export function readFollowPlaybackPreference(): boolean {
  const storage = getSessionStorage();
  if (!storage) return true;
  const stored = storage.getItem(SESSION_KEY);
  if (stored === null) return true;
  return stored === "1";
}

export function writeFollowPlaybackPreference(enabled: boolean): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(SESSION_KEY, enabled ? "1" : "0");
}

export { SESSION_KEY as FOLLOW_PLAYBACK_SESSION_KEY };
