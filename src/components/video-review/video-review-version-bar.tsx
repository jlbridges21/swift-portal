"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadManagerOptional } from "@/components/admin/upload-manager";
import type { VideoReviewVersionRow } from "@/lib/video-reviews";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface VideoReviewVersionBarProps {
  reviewId: string;
  projectId: string;
  versions: VideoReviewVersionRow[];
  activeVersionId: string;
  onVersionChange: (versionId: string) => void;
  onVersionAdded: (version: VideoReviewVersionRow) => void;
  isAdmin: boolean;
}

export function VideoReviewVersionBar({
  reviewId,
  projectId,
  versions,
  activeVersionId,
  onVersionChange,
  onVersionAdded,
  isAdmin,
}: VideoReviewVersionBarProps) {
  const uploadManager = useUploadManagerOptional();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const latestId = versions[versions.length - 1]?.id;
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? versions[versions.length - 1];

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-primary">
          Viewing{" "}
          <span className="text-accent">
            V{activeVersion?.version_number ?? "—"}
            {activeVersion?.id === latestId ? " · Latest" : ""}
          </span>
          {activeVersion?.id !== latestId && (
            <span className="ml-1 font-normal text-muted">(not the latest version)</span>
          )}
        </p>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
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
              className="min-h-11"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload new version
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div
          className={cn(
            "rounded-xl border border-dashed px-4 py-3 text-center text-xs transition",
            dragOver ? "border-accent bg-accent/5 text-primary" : "border-border/80 text-muted",
            uploading && "opacity-70"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!uploading) startUpload(e.dataTransfer.files);
          }}
        >
          {uploading
            ? "Uploading next version… track progress in the upload panel."
            : "Drag a video here to add the next version (V" +
              ((activeVersion?.version_number ?? versions.length) + 1) +
              ")."}
        </div>
      )}

      {uploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{uploadError}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 min-h-11"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Try again
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {versions.map((version) => {
          const isActive = version.id === activeVersionId;
          const isLatest = version.id === latestId;
          return (
            <Button
              key={version.id}
              type="button"
              size="sm"
              variant={isActive ? "accent" : "outline"}
              className={cn("min-h-11 flex-col items-start gap-0 py-2 h-auto", isActive && "ring-2 ring-accent/30")}
              onClick={() => onVersionChange(version.id)}
              aria-pressed={isActive}
            >
              <span className="font-semibold">
                V{version.version_number}
                {isLatest ? " · Latest" : ""}
                {isActive ? " · Viewing" : ""}
              </span>
              <span className="text-[10px] font-normal opacity-80">{formatDate(version.created_at)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
