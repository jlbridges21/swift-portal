"use client";

import { useCallback, useState } from "react";
import type { MediaAsset } from "@/lib/types";
import type { UploadProgressItem } from "@/components/admin/upload-progress-list";
import {
  uploadMediaFile,
  retryMediaSave,
  validateMediaFileBeforeUpload,
  UploadSaveError,
  UploadBinaryError,
  type UploadMediaMetadata,
  type UploadTechnicalDetails,
} from "@/lib/upload";
import { userFacingUploadError } from "@/lib/upload/upload-errors";
import { resolveUploadTitle } from "@/lib/upload/titles";

function inferMediaType(file: File): "photo" | "video" | null {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return "photo";
  if (ext && ["mp4", "mov", "m4v"].includes(ext)) return "video";
  return null;
}

export interface UploadRetryContext {
  file: File;
  mediaType: "photo" | "video";
  projectId: string | null;
  metadata?: UploadMediaMetadata;
}

function technicalFromError(err: unknown): UploadTechnicalDetails | undefined {
  if (err instanceof UploadSaveError || err instanceof UploadBinaryError) {
    return err.technical;
  }
  return undefined;
}

export function useMediaUploadQueue(options?: {
  onUploaded?: (assets: MediaAsset[]) => void;
}) {
  const [uploadItems, setUploadItems] = useState<UploadProgressItem[]>([]);

  const patchUploadItem = useCallback((id: string, patch: Partial<UploadProgressItem>) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const isUploading = uploadItems.some((i) => i.status === "uploading");

  const runUpload = useCallback(
    async (
      uploadId: string,
      file: File,
      mediaType: "photo" | "video",
      projectId: string | null,
      metadata?: UploadMediaMetadata
    ) => {
      const { asset } = await uploadMediaFile({
        projectId,
        file,
        mediaType,
        metadata,
        onProgress: ({ phase, progress, bytesLoaded, bytesTotal, resuming }) => {
          patchUploadItem(uploadId, {
            phase,
            progress,
            bytesLoaded,
            bytesTotal,
            resuming,
            status: phase === "failed" ? "error" : "uploading",
          });
        },
      });
      return asset as unknown as MediaAsset;
    },
    [patchUploadItem]
  );

  const processFiles = useCallback(
    async (
      files: File[],
      projectId: string | null,
      metadata?: UploadMediaMetadata
    ) => {
      const newItems: UploadProgressItem[] = [];
      const queue: { file: File; mediaType: "photo" | "video"; uploadId: string }[] = [];

      for (const file of files) {
        const uploadId = `${file.name}-${Date.now()}-${Math.random()}`;
        const mediaType = inferMediaType(file);
        if (!mediaType) {
          newItems.push({
            id: uploadId,
            fileName: file.name,
            progress: 0,
            phase: "failed",
            status: "error",
            error: "Unsupported file type. Use photos (JPEG, PNG, WebP) or videos (MP4, MOV, M4V).",
          });
          continue;
        }

        const validation = validateMediaFileBeforeUpload(file, mediaType);
        if (!validation.ok) {
          newItems.push({
            id: uploadId,
            fileName: file.name,
            progress: 0,
            phase: "failed",
            status: "error",
            error: validation.error,
          });
          continue;
        }

        queue.push({ file, mediaType, uploadId });
        newItems.push({
          id: uploadId,
          fileName: file.name,
          progress: 0,
          phase: "queued",
          status: "uploading",
          bytesTotal: file.size,
          mimeType: validation.mimeType,
          startedAt: Date.now(),
          retryContext: { file, mediaType, projectId, metadata },
        });
      }

      if (newItems.length) setUploadItems((prev) => [...prev, ...newItems]);

      const uploaded: MediaAsset[] = [];
      const errors: string[] = newItems
        .filter((i) => i.status === "error")
        .map((i) => `${i.fileName}: ${i.error}`);

      for (let i = 0; i < queue.length; i++) {
        const { file, mediaType, uploadId } = queue[i];
        const retryContext: UploadRetryContext = {
          file,
          mediaType,
          projectId,
          metadata: {
            title: resolveUploadTitle(
              metadata?.title?.trim() || file.name.replace(/\.[^.]+$/, ""),
              i,
              queue.length
            ),
            description: metadata?.description,
            tags: metadata?.tags,
          },
        };
        patchUploadItem(uploadId, { retryContext });

        try {
          const saved = await runUpload(uploadId, file, mediaType, projectId, retryContext.metadata);
          uploaded.push(saved);
          patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success" });
        } catch (err) {
          const technical = technicalFromError(err);
          const userMsg = technical
            ? userFacingUploadError(technical)
            : err instanceof Error
              ? err.message
              : "Upload failed";

          if (err instanceof UploadSaveError) {
            errors.push(`${file.name}: ${userMsg}`);
            patchUploadItem(uploadId, {
              status: "save_failed",
              phase: "failed",
              progress: 95,
              error: userMsg,
              technicalDetails: technical,
              pendingSave: { ...err.pendingSave, failedStep: err.step },
              retryContext,
            });
          } else {
            errors.push(`${file.name}: ${userMsg}`);
            patchUploadItem(uploadId, {
              status: "error",
              phase: "failed",
              error: userMsg,
              technicalDetails: technical,
              retryContext,
            });
          }
        }
      }

      if (uploaded.length) options?.onUploaded?.(uploaded);

      setTimeout(() => {
        setUploadItems((prev) => prev.filter((item) => item.status === "uploading" || item.status === "save_failed" || item.status === "error"));
      }, 30000);

      return { uploaded, errors };
    },
    [options, patchUploadItem, runUpload]
  );

  const handleRetrySave = useCallback(
    async (uploadId: string) => {
      const item = uploadItems.find((i) => i.id === uploadId);
      if (!item?.pendingSave) return null;

      patchUploadItem(uploadId, { status: "uploading", phase: "saving", progress: 96, error: undefined });
      try {
        const retryPayload = {
          ...item.pendingSave,
          skipStorageVerify: item.pendingSave.failedStep === "storage_verify",
        };
        const { asset } = await retryMediaSave(retryPayload, ({ phase, progress }) => {
          patchUploadItem(uploadId, { phase, progress, status: "uploading" });
        });
        const saved = asset as unknown as MediaAsset;
        patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success", pendingSave: undefined });
        options?.onUploaded?.([saved]);
        return saved;
      } catch (err) {
        const technical = technicalFromError(err);
        const msg = technical ? userFacingUploadError(technical) : err instanceof Error ? err.message : "Save failed";
        const failedStep = err instanceof UploadSaveError ? err.step : item.pendingSave?.failedStep;
        patchUploadItem(uploadId, {
          status: "save_failed",
          phase: "failed",
          error: msg,
          technicalDetails: technical,
          pendingSave: item.pendingSave ? { ...item.pendingSave, failedStep } : undefined,
        });
        throw err;
      }
    },
    [uploadItems, patchUploadItem, options]
  );

  const handleRetryUpload = useCallback(
    async (uploadId: string) => {
      const item = uploadItems.find((i) => i.id === uploadId);
      if (!item?.retryContext) return null;

      const { file, mediaType, projectId, metadata } = item.retryContext;
      patchUploadItem(uploadId, {
        status: "uploading",
        phase: "queued",
        progress: 0,
        error: undefined,
        technicalDetails: undefined,
        pendingSave: undefined,
        resuming: undefined,
        startedAt: Date.now(),
      });

      try {
        const saved = await runUpload(uploadId, file, mediaType, projectId, metadata);
        patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success" });
        options?.onUploaded?.([saved]);
        return saved;
      } catch (err) {
        const technical = technicalFromError(err);
        const userMsg = technical
          ? userFacingUploadError(technical)
          : err instanceof Error
            ? err.message
            : "Upload failed";

        if (err instanceof UploadSaveError) {
          patchUploadItem(uploadId, {
            status: "save_failed",
            phase: "failed",
            progress: 95,
            error: userMsg,
            technicalDetails: technical,
            pendingSave: { ...err.pendingSave, failedStep: err.step },
          });
        } else {
          patchUploadItem(uploadId, {
            status: "error",
            phase: "failed",
            error: userMsg,
            technicalDetails: technical,
          });
        }
        throw err;
      }
    },
    [uploadItems, patchUploadItem, runUpload, options]
  );

  return { uploadItems, processFiles, handleRetrySave, handleRetryUpload, isUploading, setUploadItems };
}
