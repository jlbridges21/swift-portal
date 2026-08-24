"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBatchProgress } from "./batch-progress";
import { useUploadManager } from "./upload-manager-context";
import { UploadManagerRow } from "./upload-manager-row";

export function UploadManagerPanel() {
  const {
    items,
    minimized,
    setMinimized,
    retryItem,
    retrySave,
    retryAllFailed,
    dismissIdle,
    requestClose,
    isUploading,
  } = useUploadManager();

  const stats = useMemo(() => computeBatchProgress(items), [items]);

  if (!items.length) return null;

  const headerTitle = isUploading
    ? `Uploading ${stats.total} file${stats.total === 1 ? "" : "s"}`
    : stats.failed > 0
      ? `${stats.complete} complete · ${stats.failed} failed`
      : `${stats.complete} upload${stats.complete === 1 ? "" : "s"} complete`;

  if (minimized) {
    return (
      <div
        className={cn(
          "fixed z-[80] right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:right-4",
          "w-[min(100vw-1.5rem,22rem)]"
        )}
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-lg",
            "transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          )}
        >
          {isUploading ? (
            <span className="text-sm font-medium text-heading">
              ↑ Uploading {stats.complete} / {stats.total}
            </span>
          ) : stats.failed > 0 ? (
            <span className="text-sm font-medium text-heading">
              {stats.complete} done · {stats.failed} failed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium text-heading">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {stats.complete} uploads complete
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            {isUploading ? <span>{stats.pct}%</span> : null}
            <ChevronUp className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[80] right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:right-4",
        "flex w-[min(100vw-1.5rem,26rem)] max-h-[min(70vh,28rem)] flex-col overflow-hidden",
        "rounded-xl border border-border bg-card shadow-xl"
      )}
      role="region"
      aria-label="Upload manager"
      aria-live="polite"
    >
      <header className="shrink-0 border-b border-border px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-heading">{headerTitle}</p>
            {isUploading ? (
              <p className="mt-0.5 text-xs text-muted">
                {stats.complete} of {stats.total} complete
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Minimize upload manager"
              onClick={() => setMinimized(true)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={isUploading ? "Minimize upload manager" : "Dismiss upload manager"}
              onClick={requestClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(isUploading || stats.pct > 0) && stats.total > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>{stats.pct}%</span>
              {stats.totalBytes > 0 ? (
                <span>
                  {stats.loadedLabel} / {stats.totalLabel}
                </span>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <UploadManagerRow
            key={item.id}
            item={item}
            onRetry={retryItem}
            onRetrySave={(id) => {
              void retrySave(id);
            }}
          />
        ))}
      </div>

      <footer className="shrink-0 border-t border-border px-3 py-2">
        {isUploading ? (
          <p className="text-xs text-muted">
            {stats.uploading} uploading · {stats.queued} queued
          </p>
        ) : stats.failed > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {stats.complete} complete · {stats.failed} failed
            </p>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={retryAllFailed}>
              Retry failed
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-heading">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {stats.complete} file{stats.complete === 1 ? "" : "s"} uploaded
            </p>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissIdle}>
              Dismiss
            </Button>
          </div>
        )}
        <button
          type="button"
          className="mt-1 flex w-full items-center justify-center gap-1 text-[11px] text-muted hover:text-heading sm:hidden"
          onClick={() => setMinimized(true)}
        >
          Minimize
          <ChevronDown className="h-3 w-3" />
        </button>
      </footer>
    </div>
  );
}
