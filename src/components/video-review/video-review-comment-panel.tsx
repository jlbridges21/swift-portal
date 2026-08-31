"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  MapPin,
  MessageSquarePlus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatReviewTimestamp } from "@/lib/video-review-format";
import { useVideoReviewPlaybackFollow, type ScrollCommentFn } from "@/lib/use-video-review-playback-follow";
import type {
  VideoReviewCommentCounts,
  VideoReviewCommentEnriched,
  VideoReviewCommentThread,
  VideoReviewCommentView,
} from "@/lib/video-review-comments";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface VideoReviewCommentPanelProps {
  reviewId: string;
  versionNumber: number;
  isAdmin: boolean;
  view: VideoReviewCommentView;
  counts: VideoReviewCommentCounts;
  threads: VideoReviewCommentThread[];
  loading: boolean;
  error: string | null;
  activeCommentId: string | null;
  onViewChange: (view: VideoReviewCommentView) => void;
  onRetry: () => void;
  onSeek: (seconds: number, commentId?: string) => void;
  onCommentsChange: () => void;
  onSelectComment: (commentId: string) => void;
  composer: React.ReactNode;
  playbackFollowCommentId: string | null;
  videoPaused: boolean;
  composerFocused: boolean;
  onRegisterScrollComment?: (fn: ScrollCommentFn) => void;
}

export function VideoReviewCommentPanel({
  reviewId,
  versionNumber,
  isAdmin,
  view,
  counts,
  threads,
  loading,
  error,
  activeCommentId,
  onViewChange,
  onRetry,
  onSeek,
  onCommentsChange,
  onSelectComment,
  composer,
  playbackFollowCommentId,
  videoPaused,
  composerFocused,
  onRegisterScrollComment,
}: VideoReviewCommentPanelProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLargeScreen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const {
    listRef,
    followEnabled,
    setFollowEnabled,
    resumeFollow,
    showJumpToCurrent,
    highlightCommentId,
    onReplyFocus,
    onReplyBlur,
  } = useVideoReviewPlaybackFollow({
    playbackFollowCommentId,
    visibleThreads: threads,
    videoPaused,
    composerFocused,
    enabledByBreakpoint: isLargeScreen,
    onRegisterScrollComment,
  });

  function handleSelectComment(commentId: string) {
    onSelectComment(commentId);
    resumeFollow();
  }

  return (
    <div className="flex h-full min-h-[320px] min-w-0 flex-col rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-black/5 lg:min-h-0">
      <div className="shrink-0 space-y-2 border-b border-border/60 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-primary">
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate">Comments · V{versionNumber}</span>
          </h2>
          <div className="relative flex shrink-0 items-center gap-1.5">
            <div className="hidden items-center gap-1.5 lg:flex">
              <label
                htmlFor="video-review-follow-playback"
                className="cursor-pointer text-[10px] leading-none text-muted"
              >
                Follow playback
              </label>
              <Switch
                id="video-review-follow-playback"
                checked={followEnabled}
                onCheckedChange={setFollowEnabled}
                aria-label="Follow playback"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-expanded={helpOpen}
              aria-label="Comment help"
              onClick={() => setHelpOpen((open) => !open)}
            >
              <HelpCircle className="h-3.5 w-3.5 text-muted" />
            </Button>
            {helpOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-white p-3 text-xs leading-relaxed text-muted shadow-lg"
                role="region"
                aria-label="Comment help"
              >
                <p>
                  Uploading a new version does not resolve notes on earlier versions — each version
                  keeps its own open feedback until someone resolves or reopens it.
                </p>
                <p className="mt-2">
                  {isAdmin
                    ? "You can mark feedback resolved when work is done. Clients can reopen if something still needs attention."
                    : "The business marks notes resolved when work is done. You can reopen if something still needs fixing."}
                </p>
              </div>
            )}
          </div>
        </div>

        {composer}

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Comment views">
          {(
            [
              ["all", "All", counts.all],
              ["unresolved", "Unresolved", counts.unresolved],
              ["resolved", "Resolved", counts.resolved],
            ] as const
          ).map(([key, label, count]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={view === key ? "accent" : "outline"}
              className="min-h-9 px-2.5 text-xs"
              role="tab"
              aria-selected={view === key}
              onClick={() => onViewChange(key)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
      </div>

      {showJumpToCurrent && (
        <div className="shrink-0 border-b border-border/60 px-3 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={resumeFollow}
          >
            Jump to current
          </Button>
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-red-600">
            {error}
            <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : counts.all === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="No comments yet"
            description="Pause the video and leave the first note on this version."
          />
        ) : view === "unresolved" && counts.unresolved === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing left unresolved"
            description="Great — every note on this version has been marked resolved."
          />
        ) : view === "resolved" && counts.resolved === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No resolved notes yet"
            description="Resolved feedback will appear here once the business marks notes done."
          />
        ) : threads.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="No comments in this view"
            description="Try another filter to see more feedback."
          />
        ) : (
          <ul className="space-y-3">
            {threads.map((thread) => (
              <CommentThread
                key={thread.comment.id}
                reviewId={reviewId}
                thread={thread}
                isAdmin={isAdmin}
                activeCommentId={activeCommentId}
                playbackHighlightId={highlightCommentId}
                onSeek={onSeek}
                onCommentsChange={onCommentsChange}
                onSelectComment={handleSelectComment}
                onReplyFocus={onReplyFocus}
                onReplyBlur={onReplyBlur}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CommentThread({
  reviewId,
  thread,
  isAdmin,
  activeCommentId,
  playbackHighlightId,
  onSeek,
  onCommentsChange,
  onSelectComment,
  onReplyFocus,
  onReplyBlur,
}: {
  reviewId: string;
  thread: VideoReviewCommentThread;
  isAdmin: boolean;
  activeCommentId: string | null;
  playbackHighlightId: string | null;
  onSeek: (seconds: number, commentId?: string) => void;
  onCommentsChange: () => void;
  onSelectComment: (commentId: string) => void;
  onReplyFocus: () => void;
  onReplyBlur: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const { comment, replies } = thread;
  const timestamp = comment.timestamp_seconds ?? 0;

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const body = replyText.trim();
    if (!body) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/video-reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parent_comment_id: comment.id, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save reply.");
        return;
      }
      setReplyText("");
      toast.success("Reply added");
      onCommentsChange();
    } catch {
      toast.error("Could not save reply.");
    } finally {
      setReplying(false);
    }
  }

  async function resolveComment() {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/video-reviews/${reviewId}/comments/${comment.id}/resolve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not resolve comment.");
        return;
      }
      if (data.changed) toast.success("Marked resolved");
      onCommentsChange();
    } finally {
      setStatusBusy(false);
    }
  }

  async function reopenComment() {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/video-reviews/${reviewId}/comments/${comment.id}/reopen`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reopen comment.");
        return;
      }
      if (data.changed) toast.success("Reopened");
      onCommentsChange();
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <li
      data-comment-id={comment.id}
      data-playback-active={playbackHighlightId === comment.id ? "true" : undefined}
      className={cn(
        "rounded-xl border transition",
        activeCommentId === comment.id && "border-accent bg-accent/5",
        playbackHighlightId === comment.id &&
          activeCommentId !== comment.id &&
          "border-accent/70 bg-accent/[0.08] ring-1 ring-accent/25 shadow-sm",
        playbackHighlightId === comment.id &&
          activeCommentId === comment.id &&
          "ring-2 ring-accent/35",
        activeCommentId !== comment.id &&
          playbackHighlightId !== comment.id &&
          "border-border/70"
      )}
    >
      <div className="p-3">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          onClick={() => {
            onSelectComment(comment.id);
            onSeek(timestamp, comment.id);
          }}
        >
          {replies.length > 0 && (
            <span
              className="mt-0.5 shrink-0 text-muted"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent">
                {formatReviewTimestamp(timestamp)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  comment.status === "resolved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                )}
              >
                {comment.status}
              </span>
              {comment.point_x != null && (
                <MapPin className="h-3.5 w-3.5 text-muted" aria-label="Has point marker" />
              )}
              {!expanded && replies.length > 0 && (
                <span className="text-[10px] text-muted">{replies.length} replies</span>
              )}
            </span>
            <p className="text-sm text-primary whitespace-pre-wrap">{comment.body}</p>
            <p className="mt-1 text-[11px] text-muted">{comment.author_name}</p>
            <StatusAttribution comment={comment} />
          </span>
        </button>

        <div className="mt-3 flex flex-wrap gap-2">
          {isAdmin && comment.status === "unresolved" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={statusBusy}
              onClick={() => void resolveComment()}
            >
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Resolve
            </Button>
          )}
          {comment.status === "resolved" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={statusBusy}
              onClick={() => void reopenComment()}
            >
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
              Reopen
            </Button>
          )}
        </div>
      </div>

      {expanded && replies.length > 0 && (
        <ul
          className="space-y-2 border-t border-border/60 bg-slate-50/80 px-3 py-3"
          onClick={() => onSeek(timestamp, comment.id)}
        >
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-black/5">
              <p className="text-sm text-primary whitespace-pre-wrap">{reply.body}</p>
              <p className="mt-1 text-[11px] text-muted">
                {reply.author_name} · {formatDate(reply.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <form onSubmit={submitReply} className="border-t border-border/60 p-3" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onFocus={onReplyFocus}
            onBlur={onReplyBlur}
            placeholder="Write a reply…"
            rows={2}
            className="mb-2 min-h-[72px] resize-y"
            disabled={replying}
          />
          <Button type="submit" size="sm" variant="outline" className="min-h-11" disabled={replying}>
            {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}
          </Button>
        </form>
      )}
    </li>
  );
}

function StatusAttribution({ comment }: { comment: VideoReviewCommentEnriched }) {
  if (comment.status === "resolved" && comment.resolved_at) {
    return (
      <p className="mt-1 text-[11px] text-emerald-700">
        Resolved by {comment.resolved_by_name ?? "team"} · {formatDate(comment.resolved_at)}
      </p>
    );
  }
  if (comment.reopened_at) {
    return (
      <p className="mt-1 text-[11px] text-amber-800">
        Reopened by {comment.reopened_by_name ?? "someone"} · {formatDate(comment.reopened_at)}
      </p>
    );
  }
  return null;
}
