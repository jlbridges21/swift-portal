"use client";

import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "success" | "error" | "cancelled";
  error?: string;
  previewUrl?: string;
  bytesLoaded?: number;
  bytesTotal?: number;
  startedAt?: number;
}

interface UploadProgressListProps {
  items: UploadProgressItem[];
  className?: string;
  onRetry?: (id: string) => void;
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

export function UploadProgressList({ items, className, onRetry, onCancel }: UploadProgressListProps) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-slate-50 p-3", className)}>
      {items.map((item) => {
        const eta = formatEta(item);
        return (
          <div
            key={item.id}
            className={cn(
              "flex gap-3 rounded-lg p-2 transition",
              item.status === "success" && "bg-emerald-50/80",
              item.status === "error" && "bg-red-50/50"
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
                      <span className="text-xs text-muted">{item.progress}%</span>
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
                  {item.status === "error" && onRetry && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRetry(item.id)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                  {item.status === "error" && !onRetry && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {item.status === "uploading" && !onCancel && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  )}
                </div>
              </div>
              {item.status === "uploading" && <Progress value={item.progress} />}
              {item.status === "error" && item.error && (
                <p className="text-xs text-red-600">{item.error}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
