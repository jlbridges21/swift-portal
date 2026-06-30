"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type DownloadStage = "preparing" | "compressing" | "starting" | "done" | "error";

const STAGE_LABELS: Record<DownloadStage, string> = {
  preparing: "Preparing files",
  compressing: "Compressing media",
  starting: "Starting download",
  done: "Download starting…",
  error: "Download failed",
};

const HELP_MESSAGE =
  "Preparing your download. Large photo and video galleries may take a minute. Please keep this page open.";

interface ProjectZipDownloadProps {
  projectId: string;
  className?: string;
  buttonClassName?: string;
  variant?: "hero" | "default";
}

export function ProjectZipDownload({
  projectId,
  className,
  buttonClassName,
  variant = "hero",
}: ProjectZipDownloadProps) {
  const [active, setActive] = useState(false);
  const [stage, setStage] = useState<DownloadStage>("preparing");
  const [progress, setProgress] = useState<number | null>(null);
  const [indeterminate, setIndeterminate] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
    stageTimerRef.current = null;
    pulseTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      abortRef.current?.abort();
    };
  }, [clearTimers]);

  function startStageAnimation() {
    clearTimers();
    setStage("preparing");
    setProgress(null);
    setIndeterminate(true);

    let tick = 0;
    stageTimerRef.current = setInterval(() => {
      tick++;
      if (tick === 2) setStage("compressing");
      if (tick >= 4) setStage("compressing");
    }, 6000);

    let pulse = 12;
    pulseTimerRef.current = setInterval(() => {
      pulse = pulse >= 68 ? 12 : pulse + 4;
      setProgress(pulse);
    }, 400);
  }

  async function handleDownload() {
    if (active) return;

    setActive(true);
    startStageAnimation();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/projects/${projectId}/download-zip`, {
        credentials: "include",
        signal: controller.signal,
      });

      clearTimers();

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.error("[project-zip-client] download failed", {
          projectId,
          status: res.status,
          error: data.error,
        });
        throw new Error(
          data.error ||
            "Download failed. Please try again, or download files individually."
        );
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Unexpected response from download server.");
      }

      setStage("starting");
      const contentLength = res.headers.get("Content-Length");
      const hasLength = contentLength && Number.parseInt(contentLength, 10) > 0;

      if (hasLength && res.body) {
        setIndeterminate(false);
        const total = Number.parseInt(contentLength!, 10);
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setProgress(Math.min(99, Math.round((received / total) * 100)));
        }

        const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
        triggerBrowserDownload(blob, parseFilename(res));
        setProgress(100);
        setStage("done");
        toast.success("Download starting…");
      } else {
        setIndeterminate(true);
        setProgress(85);
        const blob = await res.blob();
        triggerBrowserDownload(blob, parseFilename(res));
        setProgress(100);
        setStage("done");
        toast.success("Download starting…");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      clearTimers();
      setStage("error");
      setIndeterminate(false);
      setProgress(0);
      const message =
        err instanceof Error
          ? err.message
          : "Download failed. Please try again, or download files individually.";
      console.error("[project-zip-client]", message, err);
      toast.error(message);
    } finally {
      setTimeout(() => {
        setActive(false);
        setProgress(null);
        setIndeterminate(true);
        setStage("preparing");
      }, 1800);
      abortRef.current = null;
    }
  }

  const isHero = variant === "hero";

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={active}
        aria-busy={active}
        className={cn(
          isHero
            ? "group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/30 disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-slate-50 disabled:opacity-60",
          buttonClassName
        )}
      >
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className={cn("h-4 w-4", isHero && "opacity-80 group-hover:opacity-100")} />
        )}
        {active ? "Preparing download…" : "Download All"}
      </button>

      {active && (
        <div
          className={cn(
            "rounded-xl border p-4 space-y-3",
            isHero ? "border-white/20 bg-black/30 text-white backdrop-blur-sm" : "border-border bg-slate-50"
          )}
          role="status"
          aria-live="polite"
        >
          <p className={cn("text-sm", isHero ? "text-slate-100" : "text-muted")}>{HELP_MESSAGE}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={cn("font-medium", isHero ? "text-white" : "text-primary")}>
                {STAGE_LABELS[stage]}
              </span>
              {!indeterminate && progress !== null && (
                <span className={isHero ? "text-slate-300" : "text-muted"}>{progress}%</span>
              )}
            </div>
            {indeterminate ? (
              <div
                className={cn(
                  "relative h-2 w-full overflow-hidden rounded-full",
                  isHero ? "bg-white/20" : "bg-slate-200"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent animate-pulse",
                    isHero && "bg-white/90"
                  )}
                />
              </div>
            ) : (
              <Progress value={progress ?? 0} className={isHero ? "bg-white/20" : undefined} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseFilename(res: Response): string {
  const disposition = res.headers.get("Content-Disposition");
  const utfMatch = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      /* fall through */
    }
  }
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] || "deliverables.zip";
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
