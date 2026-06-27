"use client";

import { useState } from "react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, RotateCcw, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadPhase } from "@/lib/upload/constants";
import type { PendingSavePayload } from "@/lib/upload/pending-save";
import type { UploadTechnicalDetails } from "@/lib/upload/upload-errors";
import { SHOW_UPLOAD_TECHNICAL_DETAILS } from "@/lib/upload/diagnostic";
import { formatFileSize } from "@/lib/upload/validation";
import type { UploadRetryContext } from "@/hooks/use-media-upload-queue";

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  phase?: UploadPhase;
  status: "uploading" | "success" | "error" | "cancelled" | "save_failed";
  error?: string;
  previewUrl?: string;
  bytesLoaded?: number;
  bytesTotal?: number;
  startedAt?: number;
  mimeType?: string;
  pendingSave?: PendingSavePayload;
  retryContext?: UploadRetryContext;
  technicalDetails?: UploadTechnicalDetails;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  queued: "Queued",
  validating: "Checking file…",
  uploading: "Uploading",
  generating_thumbnail: "Processing thumbnail…",
  finalizing: "Uploaded, saving…",
  saving: "Saving to library…",
  uploaded: "Complete",
  failed: "Failed",
};

interface UploadProgressListProps {
  items: UploadProgressItem[];
  className?: string;
  onRetry?: (id: string) => void;
  onRetrySave?: (id: string) => void;
  onCancel?: (id: string) => void;
}

function formatEta(item: UploadProgressItem): string | null {
  if (!item.bytesLoaded || !item.bytesTotal || !item.startedAt || item.progress <= 0) return null;
  const elapsed = (Date.now() - item.startedAt) / 1000;
  if (elapsed < 1) return null;
  const rate = item.bytesLoaded / elapsed;
  const remaining = (item.bytesTotal - item.bytesLoaded) / rate;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  if (remaining < 60) return `~${Math.ceil(remaining)}s left`;
  return `~${Math.ceil(remaining / 60)}m left`;
}

function statusLabel(item: UploadProgressItem): string {
  if (item.status === "save_failed") return "Upload complete, save failed. Retry save.";
  if (item.status === "error") return item.error || "Upload failed.";
  if (item.status === "success") return "Complete";
  if (item.phase) return PHASE_LABEL[item.phase];
  return `${item.progress}%`;
}

function TechnicalDetailsPanel({ details }: { details: UploadTechnicalDetails }) {
  const [open, setOpen] = useState(true);
  if (!SHOW_UPLOAD_TECHNICAL_DETAILS) return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50/80 p-2 text-[11px] text-red-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        Technical details
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <dl className="mt-2 space-y-1 font-mono">
          <div><dt className="inline text-muted">step: </dt><dd className="inline">{details.step}</dd></div>
          <div><dt className="inline text-muted">error: </dt><dd className="inline break-all">{details.error}</dd></div>
          {details.statusCode != null && (
            <div><dt className="inline text-muted">status: </dt><dd className="inline">{details.statusCode}</dd></div>
          )}
          {details.uploadMethod && (
            <div><dt className="inline text-muted">method: </dt><dd className="inline">{details.uploadMethod}</dd></div>
          )}
          {details.bucket && (
            <div><dt className="inline text-muted">bucket: </dt><dd className="inline">{details.bucket}</dd></div>
          )}
          {details.filePath && (
            <div><dt className="inline text-muted">path: </dt><dd className="inline break-all">{details.filePath}</dd></div>
          )}
          {details.failurePhase && (
            <div><dt className="inline text-muted">phase: </dt><dd className="inline">{details.failurePhase}</dd></div>
          )}
          <div><dt className="inline text-muted">retryable: </dt><dd className="inline">{String(details.retryable ?? false)}</dd></div>
        </dl>
      )}
    </div>
  );
}

export function UploadProgressList({ items, className, onRetry, onRetrySave, onCancel }: UploadProgressListProps) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-slate-50 p-3", className)}>
      {items.map((item) => {
        const eta = formatEta(item);
        const isLarge = (item.bytesTotal ?? 0) > 100 * 1024 * 1024;

        return (
          <div
            key={item.id}
            className={cn(
              "flex gap-3 rounded-lg p-2 transition",
              item.status === "success" && "bg-emerald-50/80",
              (item.status === "error" || item.status === "save_failed") && "bg-red-50/50"
            )}
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-200">
              {item.previewUrl ? (
                <Image src={item.previewUrl} alt="" fill className="object-cover" sizes="48px" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">FILE</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-primary">{item.fileName}</span>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "uploading" && (
                    <>
                      <span className="text-xs text-muted">
                        {statusLabel(item)}
                        {item.phase === "uploading" && ` ${item.progress}%`}
                        {(item.phase === "finalizing" ||
                          item.phase === "generating_thumbnail" ||
                          item.phase === "saving") &&
                          item.progress > 0 &&
                          ` ${item.progress}%`}
                      </span>
                      {eta && <span className="hidden text-xs text-muted sm:inline">{eta}</span>}
                      {onCancel && (
                        <button type="button" onClick={() => onCancel(item.id)} className="rounded p-0.5 hover:bg-slate-200">
                          <X className="h-3.5 w-3.5 text-muted" />
                        </button>
                      )}
                    </>
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 animate-in zoom-in duration-300" />
                  )}
                  {item.status === "error" && onRetry && item.retryContext && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRetry(item.id)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retry upload
                    </Button>
                  )}
                  {item.status === "error" && !onRetry && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {item.status === "save_failed" && onRetrySave && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRetrySave(item.id)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retry save
                    </Button>
                  )}
                  {item.status === "uploading" && !onCancel && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  )}
                </div>
              </div>
              {(item.bytesTotal || item.mimeType) && item.status === "uploading" && item.phase === "queued" && (
                <p className="text-[11px] text-muted">
                  {item.mimeType && <span>{item.mimeType}</span>}
                  {item.bytesTotal ? <span> · {formatFileSize(item.bytesTotal)}</span> : null}
                  {isLarge ? <span className="text-amber-700"> · Large file — keep this screen open</span> : null}
                </p>
              )}
              {item.status === "uploading" && <Progress value={item.progress} />}
              {(item.status === "error" || item.status === "save_failed") && (
                <p className="text-xs text-red-600">{item.error || statusLabel(item)}</p>
              )}
              {item.technicalDetails && (item.status === "error" || item.status === "save_failed") && (
                <TechnicalDetailsPanel details={item.technicalDetails} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
