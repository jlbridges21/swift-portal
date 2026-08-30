"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useUploadManager } from "@/components/admin/upload-manager";
import type { MediaAsset } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import { mediaDisplayName } from "@/lib/media-display-name";
import { formatDate } from "@/lib/utils";
import { Clapperboard, History, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface VideoReviewAdminActionsProps {
  projectId: string;
  video: MediaAsset;
  reviewItem: VideoReviewListItem | null;
  onReviewsChange: () => void;
}

export function VideoReviewAdminActions({
  projectId,
  video,
  reviewItem,
  onReviewsChange,
}: VideoReviewAdminActionsProps) {
  const router = useRouter();
  const { enqueueUploads } = useUploadManager();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState(mediaDisplayName(video));
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<{
    mediaId: string;
    reviewId: string;
    versionId: string;
    reviewTitle: string;
    versionNumber: number;
    commentCount: number;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  async function createReview() {
    setCreating(true);
    try {
      const res = await fetch("/api/video-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          media_asset_id: video.id,
          title: title.trim() || mediaDisplayName(video),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not create review.");
        return;
      }
      toast.success("Video review created");
      setShowCreate(false);
      onReviewsChange();
      router.push(`/admin/projects/${projectId}/reviews/${data.review.id}`);
    } finally {
      setCreating(false);
    }
  }

  function uploadNewVersion(reviewId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/mp4,video/quicktime,video/x-m4v";
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingVersion(true);
      enqueueUploads({
        files: [file],
        projectId,
        mediaType: "video",
        onAsset: async (asset) => {
          const res = await fetch(`/api/video-reviews/${reviewId}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ media_asset_id: asset.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || "Could not attach new version.");
            return;
          }
          toast.success(`Version V${data.version_number} added`);
          onReviewsChange();
          router.refresh();
        },
        onBatchComplete: () => setUploadingVersion(false),
      });
    };
    input.click();
  }

  if (reviewItem) {
    const { review, versions } = reviewItem;
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            <Clapperboard className="h-3.5 w-3.5" />
            Review · {versions.length} version{versions.length === 1 ? "" : "s"}
          </span>
          <Link
            href={`/admin/projects/${projectId}/reviews/${review.id}`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Open review
          </Link>
        </div>
        <ul className="space-y-1 text-xs text-muted">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2">
              <History className="h-3 w-3 shrink-0" />
              V{v.version_number} · {formatDate(v.created_at)}
              {v.media_asset_id === video.id ? " · this file" : ""}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={uploadingVersion}
            onClick={() => uploadNewVersion(review.id)}
          >
            {uploadingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Upload new version
          </Button>
        </div>
        <VideoReviewDeleteModal
          open={!!deleteBlocked}
          blocked={deleteBlocked}
          removing={removing}
          onClose={() => setDeleteBlocked(null)}
          onConfirm={async () => {
            if (!deleteBlocked) return;
            setRemoving(true);
            try {
              await fetch(
                `/api/video-reviews/${deleteBlocked.reviewId}/versions/${deleteBlocked.versionId}?delete_asset=1`,
                { method: "DELETE", credentials: "include" }
              );
              setDeleteBlocked(null);
              toast.success("Review version and file removed");
              onReviewsChange();
              router.refresh();
            } finally {
              setRemoving(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 min-h-9 w-full sm:w-auto"
        onClick={() => setShowCreate(true)}
      >
        <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
        Start video review
      </Button>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Start video review">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Turn this video into a review thread. Clients can leave timestamped comments on each version.
          </p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Review title"
            aria-label="Review title"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="button" variant="accent" disabled={creating} onClick={() => void createReview()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create review"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function useVideoReviewDeleteHandler(onDeleted?: (mediaId?: string) => void) {
  const [blocked, setBlocked] = useState<{
    mediaId: string;
    reviewId: string;
    versionId: string;
    reviewTitle: string;
    versionNumber: number;
    commentCount: number;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  async function deleteMedia(id: string): Promise<boolean> {
    const res = await fetch(`/api/media/${id}`, { method: "DELETE", credentials: "include" });
    if (res.status === 409) {
      const data = await res.json();
      if (data.code === "video_review_version_linked") {
        setBlocked({
          mediaId: id,
          reviewId: data.reviewId,
          versionId: data.versionId,
          reviewTitle: data.reviewTitle,
          versionNumber: data.versionNumber,
          commentCount: data.commentCount ?? 0,
        });
        return false;
      }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Could not delete file.");
      return false;
    }
    onDeleted?.(id);
    toast.success("Deleted");
    return true;
  }

  function dismissBlocked() {
    setBlocked(null);
  }

  async function confirmRemoveVersion(deleteAsset: boolean) {
    if (!blocked) return;
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/video-reviews/${blocked.reviewId}/versions/${blocked.versionId}?delete_asset=${deleteAsset ? "1" : "0"}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not remove review version.");
        return;
      }
      if (deleteAsset) {
        setBlocked(null);
        onDeleted?.(blocked.mediaId);
        toast.success("Review version and file removed");
      } else {
        const retry = await fetch(`/api/media/${blocked.mediaId}?remove_review_version=1`, {
          method: "DELETE",
          credentials: "include",
        });
        if (retry.ok) {
          setBlocked(null);
          onDeleted?.(blocked.mediaId);
          toast.success("Removed from review and deleted file");
        } else {
          toast.success("Removed from review — delete the file again if needed");
          setBlocked(null);
          onDeleted?.(blocked.mediaId);
        }
      }
    } finally {
      setRemoving(false);
    }
  }

  return { blocked, dismissBlocked, removing, deleteMedia, confirmRemoveVersion };
}

function VideoReviewDeleteModal({
  open,
  blocked,
  removing,
  onClose,
  onConfirm,
}: {
  open: boolean;
  blocked: {
    reviewTitle: string;
    versionNumber: number;
    commentCount: number;
  } | null;
  removing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!blocked) return null;
  return (
    <Modal open={open} onClose={onClose} title="Video is part of a review">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          This file is version V{blocked.versionNumber} of “{blocked.reviewTitle}”.
          {blocked.commentCount > 0
            ? ` Removing it will permanently delete ${blocked.commentCount} comment${blocked.commentCount === 1 ? "" : "s"} on this version.`
            : " Removing it will detach this version from the review."}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={removing} onClick={onConfirm}>
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Remove version & file
          </Button>
        </div>
      </div>
    </Modal>
  );
}
