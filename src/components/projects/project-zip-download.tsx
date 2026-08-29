"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format-bytes";

type DownloadStage = "packaging" | "receiving" | "starting" | "done" | "error";

interface ZipErrorBody {
  error?: string;
  message?: string;
  details?: string;
}

interface ProjectZipDownloadProps {
  projectId: string;
  expectedFileCount?: number;
  /** UUID or `unfiled` — scopes the archive to one folder. */
  folderId?: string;
  /** Display label for folder downloads (filename uses server-side folder name). */
  folderLabel?: string;
  className?: string;
  buttonClassName?: string;
  variant?: "hero" | "default";
  compact?: boolean;
}

export function ProjectZipDownload({
  projectId,
  expectedFileCount,
  folderId,
  folderLabel,
  className,
  buttonClassName,
  variant = "hero",
  compact = false,
}: ProjectZipDownloadProps) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [stage, setStage] = useState<DownloadStage>("packaging");
  const [progress, setProgress] = useState<number | null>(null);
  const [indeterminate, setIndeterminate] = useState(true);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const packagingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimers = useCallback(() => {
    if (packagingTimerRef.current) clearInterval(packagingTimerRef.current);
    packagingTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      abortRef.current?.abort();
    };
  }, [clearTimers]);

  function startPackagingStatus() {
    clearTimers();
    setStage("packaging");
    setProgress(null);
    setIndeterminate(true);
    setErrorMessage(null);

    const fileLabel =
      expectedFileCount && expectedFileCount > 0
        ? `${expectedFileCount} file${expectedFileCount === 1 ? "" : "s"}`
        : "your files";
    setStatusLine(
      `Packaging ${fileLabel} on the server. Large galleries can take several minutes — keep this page open.`
    );

    let tick = 0;
    packagingTimerRef.current = setInterval(() => {
      tick++;
      if (tick === 8) {
        setStatusLine(
          `Still packaging ${fileLabel}. Very large shoots may take 3–5 minutes before your browser starts receiving the ZIP.`
        );
      } else if (tick === 20) {
        setStatusLine(
          `This is taking longer than usual. The server is still working — if it fails, you can download files individually below.`
        );
      }
    }, 15000);
  }

  async function handleDownload() {
    if (!mounted || active) return;

    setActive(true);
    startPackagingStatus();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const zipUrl = folderId
        ? `/api/projects/${projectId}/download-zip?folderId=${encodeURIComponent(folderId)}`
        : `/api/projects/${projectId}/download-zip`;

      const res = await fetch(zipUrl, {
        credentials: "include",
        signal: controller.signal,
      });

      clearTimers();

      const contentType = res.headers.get("Content-Type") ?? "";

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ZipErrorBody;
        console.error("[project-zip-client] download failed", {
          projectId,
          status: res.status,
          error: data.error,
          message: data.message,
          details: data.details,
        });
        const userMessage =
          data.message ||
          (res.status === 403
            ? "Downloads unlock after your final payment is complete."
            : "We couldn't prepare the full ZIP. You can still download files individually below.");
        setErrorMessage(userMessage);
        throw new Error(userMessage);
      }

      if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
        const data = (await res.json().catch(() => ({}))) as ZipErrorBody;
        const userMessage = data.message || "Unexpected response from download server.";
        setErrorMessage(userMessage);
        throw new Error(userMessage);
      }

      const expectedFiles = res.headers.get("X-Zip-Expected-Files");
      setStage("receiving");
      setIndeterminate(true);
      setStatusLine(
        expectedFiles
          ? `Receiving archive (${expectedFiles} files on server)…`
          : "Receiving archive from server…"
      );

      if (!res.body) {
        const blob = await res.blob();
        triggerBrowserDownload(blob, parseFilename(res));
        setStage("done");
        setStatusLine("Download starting…");
        toast.success("Download starting…");
        return;
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      const contentLength = res.headers.get("Content-Length");
      const total = contentLength ? Number.parseInt(contentLength, 10) : 0;
      const hasLength = total > 0;

      if (hasLength) setIndeterminate(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (hasLength) {
          setProgress(Math.min(99, Math.round((received / total) * 100)));
          setStatusLine(`Receiving archive… ${formatBytes(received)} of ${formatBytes(total)}`);
        } else {
          setStatusLine(`Receiving archive… ${formatBytes(received)} downloaded`);
        }
      }

      setStage("starting");
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      triggerBrowserDownload(blob, parseFilename(res));
      setProgress(hasLength ? 100 : null);
      setStage("done");
      setStatusLine(`Download starting (${formatBytes(received)})…`);
      toast.success(
        received > 0
          ? `Download starting (${formatBytes(received)})`
          : "Download starting…"
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      clearTimers();
      setStage("error");
      setIndeterminate(false);
      setProgress(0);
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't prepare the full ZIP. You can still download files individually below.";
      if (!errorMessage) setErrorMessage(message);
      console.error("[project-zip-client]", message, err);
      toast.error(errorMessage ?? message);
    } finally {
      setTimeout(() => {
        setActive(false);
        setProgress(null);
        setIndeterminate(true);
        setStage("packaging");
        setStatusLine(null);
        setErrorMessage(null);
      }, 5000);
      abortRef.current = null;
    }
  }

  const isHero = variant === "hero";
  const buttonLabel = folderLabel
    ? compact
      ? "Download"
      : `Download ${folderLabel}`
    : active
      ? "Preparing download…"
      : "Download All";

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!mounted || active}
        aria-busy={active}
        className={cn(
          isHero
            ? "group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/30 disabled:opacity-60"
            : compact
              ? "inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-slate-50 disabled:opacity-60"
              : "inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-slate-50 disabled:opacity-60",
          buttonClassName
        )}
      >
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className={cn("h-4 w-4", isHero && "opacity-80 group-hover:opacity-100")} />
        )}
        {active ? "Preparing download…" : buttonLabel}
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
          {statusLine && (
            <p className={cn("text-sm", isHero ? "text-slate-100" : "text-muted")}>{statusLine}</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={cn("font-medium", isHero ? "text-white" : "text-primary")}>
                {stage === "packaging"
                  ? "Packaging on server"
                  : stage === "receiving"
                    ? "Receiving archive"
                    : stage === "starting" || stage === "done"
                      ? "Saving file"
                      : "Download failed"}
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
          {stage === "error" && errorMessage && (
            <p className={cn("text-xs", isHero ? "text-red-200" : "text-red-600")}>{errorMessage}</p>
          )}
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
