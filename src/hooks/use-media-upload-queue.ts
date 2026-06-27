"use client";

import { useCallback, useState } from "react";
import type { MediaAsset } from "@/lib/types";
import type { UploadProgressItem } from "@/components/admin/upload-progress-list";
import {
  uploadMediaFile,
  retryMediaSave,
  validateMediaFileBeforeUpload,
  UploadSaveError,
  type UploadMediaMetadata,
} from "@/lib/upload";

function inferMediaType(file: File): "photo" | "video" | null {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return "photo";
  if (ext && ["mp4", "mov", "m4v"].includes(ext)) return "video";
  return null;
}

export function useMediaUploadQueue(options?: {
  onUploaded?: (assets: MediaAsset[]) => void;
}) {
  const [uploadItems, setUploadItems] = useState<UploadProgressItem[]>([]);

  const patchUploadItem = useCallback((id: string, patch: Partial<UploadProgressItem>) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const isUploading = uploadItems.some((i) => i.status === "uploading");

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
        });
      }

      if (newItems.length) setUploadItems((prev) => [...prev, ...newItems]);

      const uploaded: MediaAsset[] = [];
      const errors: string[] = newItems
        .filter((i) => i.status === "error")
        .map((i) => `${i.fileName}: ${i.error}`);

      for (const { file, mediaType, uploadId } of queue) {
        try {
          const fileMeta: UploadMediaMetadata = {
            title: metadata?.title || file.name.replace(/\.[^.]+$/, ""),
            description: metadata?.description,
            tags: metadata?.tags,
          };
          const { asset } = await uploadMediaFile({
            projectId,
            file,
            mediaType,
            metadata: fileMeta,
            onProgress: ({ phase, progress, bytesLoaded, bytesTotal }) => {
              patchUploadItem(uploadId, {
                phase,
                progress,
                bytesLoaded,
                bytesTotal,
                status: phase === "failed" ? "error" : "uploading",
              });
            },
          });
          uploaded.push(asset as unknown as MediaAsset);
          patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success" });
        } catch (err) {
          if (err instanceof UploadSaveError) {
            const msg = "Upload complete, save failed. Retry save.";
            errors.push(`${file.name}: ${msg}`);
            patchUploadItem(uploadId, {
              status: "save_failed",
              phase: "failed",
              progress: 95,
              error: err.message,
              pendingSave: err.pendingSave,
            });
          } else {
            const msg = err instanceof Error ? err.message : "Upload failed";
            errors.push(`${file.name}: ${msg}`);
            patchUploadItem(uploadId, { status: "error", phase: "failed", error: msg });
          }
        }
      }

      if (uploaded.length) options?.onUploaded?.(uploaded);

      setTimeout(() => {
        setUploadItems((prev) => prev.filter((item) => item.status === "uploading" || item.status === "save_failed"));
      }, 10000);

      return { uploaded, errors };
    },
    [options, patchUploadItem]
  );

  const handleRetrySave = useCallback(
    async (uploadId: string) => {
      const item = uploadItems.find((i) => i.id === uploadId);
      if (!item?.pendingSave) return null;

      patchUploadItem(uploadId, { status: "uploading", phase: "finalizing", progress: 95, error: undefined });
      try {
        const { asset } = await retryMediaSave(item.pendingSave, ({ phase, progress }) => {
          patchUploadItem(uploadId, { phase, progress, status: "uploading" });
        });
        const saved = asset as unknown as MediaAsset;
        patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success", pendingSave: undefined });
        options?.onUploaded?.([saved]);
        return saved;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        patchUploadItem(uploadId, {
          status: "save_failed",
          phase: "failed",
          error: msg,
          pendingSave: item.pendingSave,
        });
        throw err;
      }
    },
    [uploadItems, patchUploadItem, options]
  );

  return { uploadItems, processFiles, handleRetrySave, isUploading, setUploadItems };
}
