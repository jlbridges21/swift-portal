"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface UploadProgressListProps {
  items: UploadProgressItem[];
  className?: string;
}

export function UploadProgressList({ items, className }: UploadProgressListProps) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-slate-50 p-3", className)}>
      {items.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-primary">{item.fileName}</span>
            {item.status === "uploading" && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                {item.progress}%
              </span>
            )}
            {item.status === "success" && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            {item.status === "error" && (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            )}
          </div>
          {item.status === "uploading" && <Progress value={item.progress} />}
          {item.status === "error" && item.error && (
            <p className="text-xs text-red-600">{item.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
