"use client";

/**
 * @deprecated Prefer `useUploadManager` from `@/components/admin/upload-manager`.
 * Kept as a thin adapter for any remaining callers.
 */
import { useCallback } from "react";
import type { MediaAsset } from "@/lib/types";
import type { UploadMediaMetadata } from "@/lib/upload";
import { useUploadManager } from "@/components/admin/upload-manager";

export type { UploadRetryContext } from "@/components/admin/upload-manager/types";

export function useMediaUploadQueue(options?: {
  onUploaded?: (assets: MediaAsset[]) => void;
}) {
  const manager = useUploadManager();

  const processFiles = useCallback(
    async (files: File[], projectId: string | null, metadata?: UploadMediaMetadata) => {
      return new Promise<{ uploaded: MediaAsset[]; errors: string[] }>((resolve) => {
        manager.enqueueUploads({
          files,
          projectId,
          metadata,
          onAsset: (asset) => options?.onUploaded?.([asset]),
          onBatchComplete: resolve,
        });
      });
    },
    [manager, options]
  );

  return {
    uploadItems: manager.items,
    processFiles,
    handleRetrySave: manager.retrySave,
    handleRetryUpload: async (id: string) => {
      manager.retryItem(id);
      return null;
    },
    isUploading: manager.isUploading,
    setUploadItems: () => {
      /* no-op: managed by UploadManagerProvider */
    },
  };
}
