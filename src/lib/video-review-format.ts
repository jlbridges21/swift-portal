/** Format seconds as mm:ss or h:mm:ss for long videos. Preserves sub-second precision in storage; display rounds to tenths when needed. */
export function formatReviewTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const frac = seconds - total;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = frac >= 0.05 ? (seconds % 60).toFixed(1) : String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${ss.padStart(4, "0")}`;
  }
  return `${m}:${ss.padStart(4, "0")}`;
}
