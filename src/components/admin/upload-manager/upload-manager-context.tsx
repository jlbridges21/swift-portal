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
  MAX_CONCURRENT_UPLOADS,
  UPLOAD_AUTO_RETRY_BASE_MS,
  UPLOAD_AUTO_RETRY_LIMIT,
  uploadMediaFile,
  retryMediaSave,
  validateMediaFileBeforeUpload,
  UploadSaveError,
  UploadBinaryError,
  type UploadMediaMetadata,
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
  const retryAfterRef = useRef(new Map<string, number>());
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

      try {
        const { asset } = await uploadMediaFile({
          projectId,
          file,
          mediaType,
          metadata,
          onProgress: ({ phase, progress, bytesLoaded, bytesTotal, resuming }) => {
            const status = mapPhaseToStatus(phase);
            patchItemProgress(itemId, {
              phase,
              progress,
              bytesLoaded,
              bytesTotal,
              resuming,
              status: status === "complete" ? "processing" : status,
            });
          },
        });

        flushProgress(itemId);
        const saved = asset as unknown as MediaAsset;
        patchItem(itemId, {
          progress: 100,
          phase: "uploaded",
          status: "complete",
          bytesLoaded: file.size,
          bytesTotal: file.size,
          error: undefined,
          technicalDetails: undefined,
          pendingSave: undefined,
        });
        assetListenersRef.current.get(itemId)?.(saved);
        finishBatchSlot(batchId, saved);
      } catch (err) {
        flushProgress(itemId);
        const technical = technicalFromError(err);
        const userMsg = technical
          ? userFacingUploadError(technical)
          : err instanceof Error
            ? err.message
            : "Upload failed";

        const retries = item.autoRetryCount ?? 0;
        const retryable =
          err instanceof UploadBinaryError && technical?.retryable !== false && retries < UPLOAD_AUTO_RETRY_LIMIT;

        if (retryable) {
          const next = retries + 1;
          const delay = UPLOAD_AUTO_RETRY_BASE_MS * 2 ** (next - 1);
          retryAfterRef.current.set(itemId, Date.now() + delay);
          patchItem(itemId, {
            status: "queued",
            phase: "queued",
            progress: 0,
            autoRetryCount: next,
            error: `Retrying (${next}/${UPLOAD_AUTO_RETRY_LIMIT})…`,
          });
          setTimeout(() => pumpRef.current(), delay + 10);
          return;
        }

        if (err instanceof UploadSaveError) {
          patchItem(itemId, {
            status: "save_failed",
            phase: "failed",
            progress: 95,
            error: userMsg,
            technicalDetails: technical,
            pendingSave: { ...err.pendingSave, failedStep: err.step },
          });
          finishBatchSlot(batchId, null, `${file.name}: ${userMsg}`);
        } else {
          patchItem(itemId, {
            status: "failed",
            phase: "failed",
            error: userMsg,
            technicalDetails: technical,
          });
          finishBatchSlot(batchId, null, `${file.name}: ${userMsg}`);
        }
      }
    },
    [finishBatchSlot, flushProgress, patchItem, patchItemProgress]
  );

  const pumpQueue = useCallback(() => {
    const now = Date.now();
    while (inFlightRef.current.size < MAX_CONCURRENT_UPLOADS) {
      const next = itemsRef.current.find((i) => {
        if (i.status !== "queued") return false;
        if (inFlightRef.current.has(i.id)) return false;
        const after = retryAfterRef.current.get(i.id);
        return !after || after <= now;
      });
      if (!next) break;

      inFlightRef.current.add(next.id);
      retryAfterRef.current.delete(next.id);
      patchItem(next.id, {
        status: "uploading",
        phase: "validating",
        startedAt: Date.now(),
        error: next.error?.startsWith("Retrying") ? undefined : next.error,
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
  }, [patchItem, runOneUpload]);

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
          autoRetryCount: 0,
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
    retryAfterRef.current.delete(id);
    patchItem(id, {
      status: "queued",
      phase: "queued",
      progress: 0,
      error: undefined,
      technicalDetails: undefined,
      pendingSave: undefined,
      resuming: undefined,
      autoRetryCount: 0,
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
        const retryPayload = {
          ...item.pendingSave,
          skipStorageVerify: item.pendingSave.failedStep === "storage_verify",
        };
        const { asset } = await retryMediaSave(retryPayload, ({ phase, progress }) => {
          patchItem(id, { phase, progress, status: mapPhaseToStatus(phase, "processing") });
        });
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
