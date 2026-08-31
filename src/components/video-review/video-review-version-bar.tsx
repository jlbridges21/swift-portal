"use client";

import { useRef, useState, useEffect } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { useUploadManagerOptional } from "@/components/admin/upload-manager";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import { fetchThumbUrls } from "@/lib/media-thumb-client";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface VideoReviewVersionUploadProps {
  reviewId: string;
  projectId: string;
  nextVersionNumber: number;
  onVersionAdded: (version: VideoReviewVersionRow) => void;
}

export function VideoReviewVersionUpload({
  reviewId,
  projectId,
  nextVersionNumber,
  onVersionAdded,
}: VideoReviewVersionUploadProps) {
  const uploadManager = useUploadManagerOptional();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function startUpload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(f.name));
    if (!list.length) {
      toast.error("Choose a video file (MP4, MOV, or M4V).");
      return;
    }
    if (!uploadManager) {
      toast.error("Upload is unavailable in this view.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    uploadManager.enqueueUploads({
      files: list.slice(0, 1),
      projectId,
      mediaType: "video",
      onAsset: async (asset) => {
        try {
          const res = await fetch(`/api/video-reviews/${reviewId}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ media_asset_id: asset.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            const message = data.error || "Could not attach the new version to this review.";
            setUploadError(message);
            toast.error(message);
            return;
          }
          toast.success(`Version V${data.version_number} is ready`);
          onVersionAdded(data as VideoReviewVersionRow);
        } catch {
          const message = "Could not attach the new version. Your file uploaded — try again.";
          setUploadError(message);
          toast.error(message);
        }
      },
      onBatchComplete: ({ errors }) => {
        setUploading(false);
        if (errors.length) {
          setUploadError(errors[0] ?? "Upload failed. You can retry without re-selecting if the file saved.");
        }
      },
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) startUpload(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="accent"
        className="min-h-9 shrink-0"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        Upload new version
      </Button>
      {uploadError && (
        <button
          type="button"
          className="max-w-[220px] truncate text-right text-[10px] text-red-600 underline"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadError} — Try again
        </button>
      )}
      {!uploading && !uploadError && (
        <span className="sr-only">Adds version V{nextVersionNumber}</span>
      )}
    </div>
  );
}

interface VideoReviewVersionPillsProps {
  versions: VideoReviewVersionRow[];
  activeVersionId: string;
  onVersionChange: (versionId: string) => void;
}

export function VideoReviewVersionPills({
  versions,
  activeVersionId,
  onVersionChange,
}: VideoReviewVersionPillsProps) {
  const latestId = versions[versions.length - 1]?.id;
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = versions.map((v) => v.media_asset_id).filter(Boolean);
    if (!ids.length) return;
    void fetchThumbUrls(ids).then((urls) => {
      const found: Record<string, string> = {};
      for (const [id, url] of Object.entries(urls)) {
        if (url) found[id] = url;
      }
      setThumbUrls(found);
    });
  }, [versions]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="tablist" aria-label="Review versions">
      {versions.map((version) => {
        const isActive = version.id === activeVersionId;
        const isLatest = version.id === latestId;
        const poster = thumbUrls[version.media_asset_id];
        return (
          <button
            key={version.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={formatDate(version.created_at)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isActive
                ? "bg-accent text-white shadow-sm"
                : "bg-slate-100 text-primary hover:bg-slate-200"
            )}
            onClick={() => onVersionChange(version.id)}
          >
            {poster ? (
              <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-black/10">
                <RemoteImage src={poster} alt="" fill className="object-cover" sizes="40px" />
              </span>
            ) : null}
            <span>
              V{version.version_number}
              {isLatest && (
                <span className={cn(isActive ? "text-white/90" : "text-muted")}> · Latest</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Use VideoReviewVersionUpload + VideoReviewVersionPills */
export function VideoReviewVersionBar({
  reviewId,
  projectId,
  versions,
  activeVersionId,
  onVersionChange,
  onVersionAdded,
  isAdmin,
}: {
  reviewId: string;
  projectId: string;
  versions: VideoReviewVersionRow[];
  activeVersionId: string;
  onVersionChange: (versionId: string) => void;
  onVersionAdded: (version: VideoReviewVersionRow) => void;
  isAdmin: boolean;
}) {
  const nextVersionNumber = (versions[versions.length - 1]?.version_number ?? versions.length) + 1;
  return (
    <div className="space-y-2">
      {isAdmin && (
        <VideoReviewVersionUpload
          reviewId={reviewId}
          projectId={projectId}
          nextVersionNumber={nextVersionNumber}
          onVersionAdded={onVersionAdded}
        />
      )}
      <VideoReviewVersionPills
        versions={versions}
        activeVersionId={activeVersionId}
        onVersionChange={onVersionChange}
      />
    </div>
  );
}
