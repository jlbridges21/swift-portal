"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/upload/validation";
import type { UploadManagerItem } from "./types";

interface UploadManagerRowProps {
  item: UploadManagerItem;
  onRetry: (id: string) => void;
  onRetrySave: (id: string) => void;
}

function statusText(item: UploadManagerItem): string {
  if (item.status === "complete") return "Complete";
  if (item.status === "save_failed") return "Save failed";
  if (item.status === "failed") return item.error || "Upload failed";
  if (item.status === "queued") {
    if (item.error?.startsWith("Retrying")) return item.error;
    return "Queued";
  }
  if (item.status === "processing") {
    if (item.phase === "saving") return "Saving…";
    if (item.phase === "finalizing") return "Finalizing…";
    return "Processing…";
  }
  if (item.resuming) return "Resuming…";
  if (item.phase === "uploading") return `Uploading · ${item.progress}%`;
  return "Uploading…";
}

function UploadManagerRowInner({ item, onRetry, onRetrySave }: UploadManagerRowProps) {
  const showBar =
    item.status === "uploading" ||
    item.status === "processing" ||
    (item.status === "queued" && item.progress > 0);

  return (
    <div
      className={cn(
        "border-b border-border/60 px-3 py-2 last:border-b-0",
        item.status === "complete" && "bg-emerald-50/40 dark:bg-emerald-950/20",
        (item.status === "failed" || item.status === "save_failed") && "bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-heading">{item.fileName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
            <span
              className={cn(
                (item.status === "failed" || item.status === "save_failed") && "text-destructive"
              )}
            >
              {statusText(item)}
            </span>
            {item.fileSize > 0 && item.status !== "complete" ? (
              <span>{formatFileSize(item.bytesLoaded ?? 0)} / {formatFileSize(item.fileSize)}</span>
            ) : null}
          </div>
          {showBar ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
              />
            </div>
          ) : null}
          {(item.status === "failed" || item.status === "save_failed") && item.error ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-destructive">{item.error}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {item.status === "complete" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Complete" />
          ) : null}
          {item.status === "uploading" || item.status === "processing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-hidden />
          ) : null}
          {item.status === "failed" && item.retryContext ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          ) : null}
          {item.status === "save_failed" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onRetrySave(item.id)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          ) : null}
          {item.status === "failed" && !item.retryContext ? (
            <AlertCircle className="h-4 w-4 text-destructive" aria-label="Failed" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const UploadManagerRow = memo(
  UploadManagerRowInner,
  (prev, next) =>
    prev.item === next.item &&
    prev.onRetry === next.onRetry &&
    prev.onRetrySave === next.onRetrySave
);
