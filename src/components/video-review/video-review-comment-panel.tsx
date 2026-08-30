"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  MessageSquarePlus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatReviewTimestamp } from "@/lib/video-review-format";
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
  newCommentForm: React.ReactNode;
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
  newCommentForm,
}: VideoReviewCommentPanelProps) {
  return (
    <div className="flex min-h-[320px] flex-col rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
      <div className="mb-3 space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
          <MessageSquarePlus className="h-4 w-4 text-accent" />
          Comments · V{versionNumber}
        </h2>
        <p className="text-xs leading-relaxed text-muted">
          Uploading a new version does not resolve notes on earlier versions — each version keeps its
          own open feedback until someone resolves or reopens it.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          {isAdmin
            ? "You can mark feedback resolved when work is done. Clients can reopen if something still needs attention."
            : "The business marks notes resolved when work is done. You can reopen if something still needs fixing."}
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Comment views">
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
              className="min-h-11"
              role="tab"
              aria-selected={view === key}
              onClick={() => onViewChange(key)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
      </div>

      {newCommentForm}

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                onSeek={onSeek}
                onCommentsChange={onCommentsChange}
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
  onSeek,
  onCommentsChange,
}: {
  reviewId: string;
  thread: VideoReviewCommentThread;
  isAdmin: boolean;
  activeCommentId: string | null;
  onSeek: (seconds: number, commentId?: string) => void;
  onCommentsChange: () => void;
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
      className={cn(
        "rounded-xl border transition",
        activeCommentId === comment.id ? "border-accent bg-accent/5" : "border-border/70"
      )}
    >
      <div className="p-3">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          onClick={() => onSeek(timestamp, comment.id)}
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
