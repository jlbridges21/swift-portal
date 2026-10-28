"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MediaAsset } from "@/lib/types";
import {
  MAX_CONCURRENT_RESUMABLE_UPLOADS,
  MAX_CONCURRENT_UPLOADS,
  shouldUseTusUpload,
  UPLOAD_MAX_ATTEMPTS_WITHOUT_PROGRESS,
  UPLOAD_RETRY_BASE_MS,
  UPLOAD_RETRY_MAX_DELAY_MS,
  UPLOAD_SAVE_AUTO_RETRIES,
  uploadMediaFile,
  retryMediaSave,
  validateMediaFileBeforeUpload,
  UploadSaveError,
  UploadBinaryError,
  type PendingSavePayload,
  type UploadMediaMetadata,
  type UploadProgressUpdate,
} from "@/lib/upload";
import { userFacingUploadError } from "@/lib/upload/upload-errors";
import { resolveUploadTitle } from "@/lib/upload/titles";
import {
  mapPhaseToStatus,
  type EnqueueUploadsOptions,
  type UploadManagerItem,
  type UploadRetryContext,
} from "./types";
import { UploadManagerPanel } from "./upload-manager-panel";

interface UploadManagerContextValue {
  items: UploadManagerItem[];
  isUploading: boolean;
  enqueueUploads: (options: EnqueueUploadsOptions) => void;
  retryItem: (id: string) => void;
  retrySave: (id: string) => Promise<MediaAsset | null>;
  retryAllFailed: () => void;
  dismissIdle: () => void;
  requestClose: () => void;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

function inferMediaType(file: File): "photo" | "video" | "document" | null {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (
    mime === "application/pdf" ||
    mime === "application/zip" ||
    mime === "application/x-zip-compressed"
  ) {
    return "document";
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return "photo";
  if (ext && ["mp4", "mov", "m4v"].includes(ext)) return "video";
  if (ext && ["pdf", "zip"].includes(ext)) return "document";
  return null;
}

/**
 * Wait before retrying an upload. While the browser reports offline, wait (without
 * limit) for the connection to come back instead of burning attempts.
 */
async function waitBeforeRetry(delayMs: number, setNotice: (notice: string) => void): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setNotice("Waiting for internet connection…");
    await new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
    setNotice("Reconnecting…");
    await new Promise((r) => setTimeout(r, 1000));
    return;
  }
  setNotice("Connection interrupted — reconnecting…");
  await new Promise((r) => setTimeout(r, delayMs));
}

function technicalFromError(err: unknown) {
  if (err instanceof UploadSaveError || err instanceof UploadBinaryError) {
    return err.technical;
  }
  return undefined;
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadManagerItem[]>([]);
  const [minimized, setMinimized] = useState(false);
  const itemsRef = useRef(items);

  const inFlightRef = useRef(new Set<string>());
  const progressThrottleRef = useRef(
    new Map<string, { patch: Partial<UploadManagerItem>; timer: ReturnType<typeof setTimeout> | null }>()
  );
  const assetListenersRef = useRef(new Map<string, (asset: MediaAsset) => void>());
  const batchListenersRef = useRef(
    new Map<
      string,
      {
        remaining: number;
        uploaded: MediaAsset[];
        errors: string[];
        onComplete?: EnqueueUploadsOptions["onBatchComplete"];
      }
    >()
  );
  const pumpRef = useRef<() => void>(() => {});

  const patchItem = useCallback((id: string, patch: Partial<UploadManagerItem>) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      itemsRef.current = next;
      return next;
    });
  }, []);

  const patchItemProgress = useCallback(
    (id: string, patch: Partial<UploadManagerItem>) => {
      const existing = progressThrottleRef.current.get(id);
      if (existing?.timer) {
        existing.patch = { ...existing.patch, ...patch };
        return;
      }
      const entry: { patch: Partial<UploadManagerItem>; timer: ReturnType<typeof setTimeout> | null } = {
        patch,
        timer: null,
      };
      progressThrottleRef.current.set(id, entry);
      // Immediate first paint, then coalesce bursts.
      patchItem(id, patch);
      entry.timer = setTimeout(() => {
        const latest = progressThrottleRef.current.get(id);
        progressThrottleRef.current.delete(id);
        if (latest && latest.patch !== patch) patchItem(id, latest.patch);
      }, 100);
    },
    [patchItem]
  );

  const flushProgress = useCallback(
    (id: string) => {
      const pending = progressThrottleRef.current.get(id);
      if (pending?.timer) {
        clearTimeout(pending.timer);
        progressThrottleRef.current.delete(id);
        patchItem(id, pending.patch);
      }
    },
    [patchItem]
  );

  const finishBatchSlot = useCallback((batchId: string, asset: MediaAsset | null, error?: string) => {
    const batch = batchListenersRef.current.get(batchId);
    if (!batch) return;
    if (asset) batch.uploaded.push(asset);
    if (error) batch.errors.push(error);
    batch.remaining -= 1;
    if (batch.remaining <= 0) {
      batchListenersRef.current.delete(batchId);
      batch.onComplete?.({ uploaded: batch.uploaded, errors: batch.errors });
    }
  }, []);

  const runOneUpload = useCallback(
    async (itemId: string) => {
      const item = itemsRef.current.find((i) => i.id === itemId);
      if (!item?.retryContext) return;

      const { file, mediaType, projectId, metadata } = item.retryContext;
      const batchId = itemId.split("::")[0];
      let resumeFilePath = item.retryContext.resumeFilePath;

      const onProgress = ({ phase, progress, bytesLoaded, bytesTotal, resuming }: UploadProgressUpdate) => {
        const status = mapPhaseToStatus(phase);
        patchItemProgress(itemId, {
          phase,
          progress,
          bytesLoaded,
          bytesTotal,
          resuming,
          // An in-flight file never shows as queued/complete until it truly is.
          status: status === "complete" ? "processing" : status === "queued" ? "uploading" : status,
        });
      };

      const succeed = (asset: Record<string, unknown>) => {
        flushProgress(itemId);
        const saved = asset as unknown as MediaAsset;
        patchItem(itemId, {
          progress: 100,
          phase: "uploaded",
          status: "complete",
          bytesLoaded: file.size,
          bytesTotal: file.size,
          error: undefined,
          notice: undefined,
          technicalDetails: undefined,
          pendingSave: undefined,
        });
        assetListenersRef.current.get(itemId)?.(saved);
        finishBatchSlot(batchId, saved);
      };

      // Retry transient failures in place (this file keeps its slot, so the queue never
      // jumps ahead), resuming TUS uploads from the bytes storage already has.
      let attemptsWithoutProgress = 0;
      let bestBytes = 0;
      let lastErr: unknown;

      for (;;) {
        try {
          const { asset } = await uploadMediaFile({
            projectId,
            file,
            mediaType,
            metadata,
            resumeFilePath,
            onProgress,
          });
          succeed(asset);
          return;
        } catch (err) {
          lastErr = err;
          if (!(err instanceof UploadBinaryError) || !err.retryable) break;

          if (err.uploadMethod === "tus" && err.filePath) {
            resumeFilePath = err.filePath;
            const ctx = itemsRef.current.find((i) => i.id === itemId)?.retryContext;
            if (ctx) patchItem(itemId, { retryContext: { ...ctx, resumeFilePath } });
          }

          const reached = err.technical.bytesUploaded ?? 0;
          if (reached > bestBytes) {
            bestBytes = reached;
            attemptsWithoutProgress = 0;
          } else {
            attemptsWithoutProgress += 1;
          }
          if (attemptsWithoutProgress >= UPLOAD_MAX_ATTEMPTS_WITHOUT_PROGRESS) break;

          flushProgress(itemId);
          const delay = Math.min(
            UPLOAD_RETRY_MAX_DELAY_MS,
            UPLOAD_RETRY_BASE_MS * 2 ** Math.max(0, attemptsWithoutProgress - 1)
          );
          await waitBeforeRetry(delay, (notice) =>
            patchItem(itemId, { status: "uploading", notice, technicalDetails: err.technical })
          );
          patchItem(itemId, { notice: undefined });
        }
      }

      // Bytes are in storage but the metadata save failed — retry the save (idempotent
      // per file_path) before asking the user to do anything.
      if (lastErr instanceof UploadSaveError) {
        let pending: PendingSavePayload = { ...lastErr.pendingSave, failedStep: lastErr.step };
        for (let attempt = 1; attempt <= UPLOAD_SAVE_AUTO_RETRIES; attempt += 1) {
          await waitBeforeRetry(UPLOAD_RETRY_BASE_MS * 2 ** (attempt - 1), (notice) =>
            patchItem(itemId, { status: "processing", notice })
          );
          patchItem(itemId, { notice: undefined });
          try {
            const { asset } = await retryMediaSave(pending, onProgress, file);
            succeed(asset);
            return;
          } catch (err) {
            lastErr = err;
            if (!(err instanceof UploadSaveError)) break;
            pending = { ...err.pendingSave, failedStep: err.step };
          }
        }
      }

      flushProgress(itemId);
      const technical = technicalFromError(lastErr);
      const userMsg = technical
        ? userFacingUploadError(technical)
        : lastErr instanceof Error
          ? lastErr.message
          : "Upload failed";

      if (lastErr instanceof UploadSaveError) {
        patchItem(itemId, {
          status: "save_failed",
          phase: "failed",
          progress: 95,
          error: userMsg,
          notice: undefined,
          technicalDetails: technical,
          pendingSave: { ...lastErr.pendingSave, failedStep: lastErr.step },
        });
      } else {
        patchItem(itemId, {
          status: "failed",
          phase: "failed",
          error: userMsg,
          notice: undefined,
          technicalDetails: technical,
        });
      }
      finishBatchSlot(batchId, null, `${file.name}: ${userMsg}`);
    },
    [finishBatchSlot, flushProgress, patchItem, patchItemProgress]
  );

  const isResumableItem = useCallback((i: UploadManagerItem) => {
    return shouldUseTusUpload(i.retryContext?.file.size ?? i.fileSize);
  }, []);

  const pumpQueue = useCallback(() => {
    while (inFlightRef.current.size < MAX_CONCURRENT_UPLOADS) {
      // Large (TUS) files upload one at a time so each finishes quickly with full
      // bandwidth; small photos keep flowing through the remaining slots.
      let resumableInFlight = 0;
      for (const id of inFlightRef.current) {
        const inFlight = itemsRef.current.find((i) => i.id === id);
        if (inFlight && isResumableItem(inFlight)) resumableInFlight += 1;
      }
      const next = itemsRef.current.find((i) => {
        if (i.status !== "queued") return false;
        if (inFlightRef.current.has(i.id)) return false;
        return !(resumableInFlight >= MAX_CONCURRENT_RESUMABLE_UPLOADS && isResumableItem(i));
      });
      if (!next) break;

      inFlightRef.current.add(next.id);
      patchItem(next.id, {
        status: "uploading",
        phase: "validating",
        startedAt: Date.now(),
        error: undefined,
        notice: undefined,
      });

      void (async () => {
        try {
          await runOneUpload(next.id);
        } finally {
          inFlightRef.current.delete(next.id);
          pumpRef.current();
        }
      })();
    }
  }, [isResumableItem, patchItem, runOneUpload]);

  useEffect(() => {
    pumpRef.current = pumpQueue;
  }, [pumpQueue]);

  const enqueueUploads = useCallback(
    (options: EnqueueUploadsOptions) => {
      const { files, projectId, mediaType: forcedType, metadata, onAsset, onBatchComplete } = options;
      if (!files.length) return;

      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const staged: UploadManagerItem[] = [];

      for (const file of files) {
        const id = `${batchId}::${file.name}-${Math.random().toString(36).slice(2, 9)}`;
        const mediaType = forcedType ?? inferMediaType(file);

        if (!mediaType) {
          staged.push({
            id,
            fileName: file.name,
            fileSize: file.size,
            progress: 0,
            phase: "failed",
            status: "failed",
            error:
              "Unsupported file type. Use photos (JPEG, PNG, WebP), videos (MP4, MOV, M4V), or PDF/ZIP.",
            bytesTotal: file.size,
          });
          continue;
        }

        const validation = validateMediaFileBeforeUpload(file, mediaType);
        if (!validation.ok) {
          staged.push({
            id,
            fileName: file.name,
            fileSize: file.size,
            progress: 0,
            phase: "failed",
            status: "failed",
            error: validation.error,
            bytesTotal: file.size,
            mimeType: file.type,
          });
          continue;
        }

        staged.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          phase: "queued",
          status: "queued",
          bytesTotal: file.size,
          mimeType: validation.mimeType,
          startedAt: Date.now(),
          retryContext: {
            file,
            mediaType,
            projectId,
            metadata: {
              title: metadata?.title?.trim() || file.name.replace(/\.[^.]+$/, ""),
              description: metadata?.description,
              tags: metadata?.tags,
            },
          },
        });
      }

      const queued = staged.filter((i) => i.status === "queued");
      queued.forEach((item, i) => {
        if (!item.retryContext) return;
        const titleBase =
          metadata?.title?.trim() || item.fileName.replace(/\.[^.]+$/, "");
        const retryContext: UploadRetryContext = {
          ...item.retryContext,
          metadata: {
            ...item.retryContext.metadata,
            title: resolveUploadTitle(titleBase, i, queued.length),
          },
        };
        item.retryContext = retryContext;
        if (onAsset) assetListenersRef.current.set(item.id, onAsset);
      });

      if (onBatchComplete) {
        const earlyErrors = staged
          .filter((i) => i.status === "failed")
          .map((i) => `${i.fileName}: ${i.error}`);
        if (queued.length === 0) {
          onBatchComplete({ uploaded: [], errors: earlyErrors });
        } else {
          batchListenersRef.current.set(batchId, {
            remaining: queued.length,
            uploaded: [],
            errors: earlyErrors,
            onComplete: onBatchComplete,
          });
        }
      }

      setItems((prev) => {
        const next = [...prev, ...staged];
        itemsRef.current = next;
        return next;
      });
      setMinimized(false);
      queueMicrotask(() => pumpRef.current());
    },
    []
  );

  // Kick the pump when newly queued items appear (including auto-retries).
  const queuedCount = items.reduce((n, i) => (i.status === "queued" ? n + 1 : n), 0);
  useEffect(() => {
    if (queuedCount > 0) pumpQueue();
  }, [queuedCount, pumpQueue]);

  const retryItem = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item?.retryContext) return;
    patchItem(id, {
      status: "queued",
      phase: "queued",
      progress: 0,
      error: undefined,
      technicalDetails: undefined,
      pendingSave: undefined,
      resuming: undefined,
      notice: undefined,
      startedAt: Date.now(),
    });
    queueMicrotask(() => pumpRef.current());
  }, [patchItem]);

  const retrySave = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.pendingSave) return null;

      patchItem(id, { status: "processing", phase: "saving", progress: 96, error: undefined });
      try {
        // Never skip storage verify. Pass the File so a missing object can be re-uploaded.
        const { asset } = await retryMediaSave(
          item.pendingSave,
          ({ phase, progress, bytesLoaded, bytesTotal, resuming }) => {
            patchItem(id, {
              phase,
              progress,
              bytesLoaded,
              bytesTotal,
              resuming,
              status: mapPhaseToStatus(phase, "processing"),
            });
          },
          item.retryContext?.file ?? null
        );
        const saved = asset as unknown as MediaAsset;
        patchItem(id, {
          progress: 100,
          phase: "uploaded",
          status: "complete",
          pendingSave: undefined,
        });
        assetListenersRef.current.get(id)?.(saved);
        return saved;
      } catch (err) {
        const technical = technicalFromError(err);
        const msg = technical
          ? userFacingUploadError(technical)
          : err instanceof Error
            ? err.message
            : "Save failed";
        const failedStep = err instanceof UploadSaveError ? err.step : item.pendingSave?.failedStep;
        patchItem(id, {
          status: "save_failed",
          phase: "failed",
          error: msg,
          technicalDetails: technical,
          pendingSave: item.pendingSave ? { ...item.pendingSave, failedStep } : undefined,
        });
        throw err;
      }
    },
    [patchItem]
  );

  const retryAllFailed = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.status === "save_failed" && item.pendingSave) {
        void retrySave(item.id);
      } else if (item.status === "failed" && item.retryContext) {
        retryItem(item.id);
      }
    }
  }, [retryItem, retrySave]);

  const dismissIdle = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter(
        (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing"
      );
      itemsRef.current = next;
      return next;
    });
  }, []);

  const requestClose = useCallback(() => {
    const active = itemsRef.current.some(
      (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing"
    );
    if (active) {
      setMinimized(true);
      return;
    }
    itemsRef.current = [];
    setItems([]);
  }, []);

  const isUploading = items.some(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing"
  );

  useEffect(() => {
    if (!isUploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isUploading]);

  const value = useMemo<UploadManagerContextValue>(
    () => ({
      items,
      isUploading,
      enqueueUploads,
      retryItem,
      retrySave,
      retryAllFailed,
      dismissIdle,
      requestClose,
      minimized,
      setMinimized,
    }),
    [
      items,
      isUploading,
      enqueueUploads,
      retryItem,
      retrySave,
      retryAllFailed,
      dismissIdle,
      requestClose,
      minimized,
    ]
  );

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
      <UploadManagerPanel />
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error("useUploadManager must be used within UploadManagerProvider");
  }
  return ctx;
}

export function useUploadManagerOptional() {
  return useContext(UploadManagerContext);
}
