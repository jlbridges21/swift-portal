import type { VideoReviewComment } from "@/lib/types";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import {
  buildCommentThreads,
  countTopLevelComments,
  filterTopLevelForView,
  type VideoReviewCommentCounts,
  type VideoReviewCommentEnriched,
  type VideoReviewCommentThread,
  type VideoReviewCommentView,
} from "@/lib/video-review-comment-model";

export interface VideoReviewPollResult {
  serverTime: string;
  counts: VideoReviewCommentCounts;
  changes: VideoReviewCommentEnriched[];
  versions: VideoReviewVersionRow[];
}

export function populateCommentStore(
  threads: VideoReviewCommentThread[],
  markerComments: VideoReviewCommentEnriched[]
): Map<string, VideoReviewCommentEnriched> {
  const store = new Map<string, VideoReviewCommentEnriched>();
  for (const thread of threads) {
    store.set(thread.comment.id, thread.comment);
    for (const reply of thread.replies) {
      store.set(reply.id, reply);
    }
  }
  for (const marker of markerComments) {
    store.set(marker.id, marker);
  }
  return store;
}

export function mergeCommentStore(
  store: Map<string, VideoReviewCommentEnriched>,
  changes: VideoReviewCommentEnriched[]
): Map<string, VideoReviewCommentEnriched> {
  const next = new Map(store);
  for (const change of changes) {
    next.set(change.id, change);
  }
  return next;
}

export function snapshotFromCommentStore(
  store: Map<string, VideoReviewCommentEnriched>,
  view: VideoReviewCommentView
): {
  threads: VideoReviewCommentThread[];
  markerComments: VideoReviewCommentEnriched[];
  counts: VideoReviewCommentCounts;
} {
  const rows = Array.from(store.values()) as VideoReviewComment[];
  const enriched = store;
  const counts = countTopLevelComments(rows);
  const threads = buildCommentThreads(rows, enriched, view);
  const markerComments = filterTopLevelForView(rows, view)
    .map((c) => enriched.get(c.id)!)
    .filter(Boolean);
  return { threads, markerComments, counts };
}

export function mergeVersionRows(
  existing: VideoReviewVersionRow[],
  incoming: VideoReviewVersionRow[]
): VideoReviewVersionRow[] {
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((v) => [v.id, v]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => a.version_number - b.version_number);
}

/** Expected poll requests for one visible user over a duration (ms). */
export function estimatePollRequestVolume(options: {
  durationMs: number;
  baseIntervalMs: number;
  maxIntervalMs: number;
  idleAfterMs: number;
  /** Fraction of time considered idle (0–1). */
  idleFraction?: number;
}): { activeRequests: number; totalEstimate: number } {
  const idleFraction = options.idleFraction ?? 0;
  const activeMs = options.durationMs * (1 - idleFraction);
  const idleMs = options.durationMs * idleFraction;
  const activeRequests = Math.ceil(activeMs / options.baseIntervalMs);
  const idleRequests = Math.ceil(idleMs / options.maxIntervalMs);
  return { activeRequests, totalEstimate: activeRequests + idleRequests + 1 };
}
