"use client";

import type { MediaAsset } from "@/lib/types";
import type { UploadPhase } from "@/lib/upload/constants";
import type { PendingSavePayload } from "@/lib/upload/pending-save";
import type { UploadMediaMetadata } from "@/lib/upload/media-upload-client";
import type { UploadTechnicalDetails } from "@/lib/upload/upload-errors";

/** UI-facing lifecycle for the upload manager. */
export type UploadItemStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "complete"
  | "failed"
  | "save_failed";

export interface UploadRetryContext {
  file: File;
  mediaType: "photo" | "video" | "document";
  projectId: string | null;
  metadata?: UploadMediaMetadata;
}

export interface UploadManagerItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  phase: UploadPhase;
  status: UploadItemStatus;
  error?: string;
  bytesLoaded?: number;
  bytesTotal?: number;
  resuming?: boolean;
  startedAt?: number;
  mimeType?: string;
  pendingSave?: PendingSavePayload;
  retryContext?: UploadRetryContext;
  technicalDetails?: UploadTechnicalDetails;
  autoRetryCount?: number;
}

export interface EnqueueUploadsOptions {
  files: File[];
  projectId: string | null;
  /** When set, all files use this type; otherwise inferred per file. */
  mediaType?: "photo" | "video" | "document";
  metadata?: UploadMediaMetadata;
  /** Called once per successfully saved asset (may fire while queue still running). */
  onAsset?: (asset: MediaAsset) => void;
  /** Called once when this enqueue batch finishes (successes + failures). */
  onBatchComplete?: (result: { uploaded: MediaAsset[]; errors: string[] }) => void;
}

export function mapPhaseToStatus(
  phase: UploadPhase,
  fallback: UploadItemStatus = "uploading"
): UploadItemStatus {
  if (phase === "queued") return "queued";
  if (phase === "uploaded") return "complete";
  if (phase === "failed") return "failed";
  if (phase === "saving" || phase === "finalizing" || phase === "generating_thumbnail") {
    return "processing";
  }
  if (phase === "uploading" || phase === "validating") return "uploading";
  return fallback;
}
