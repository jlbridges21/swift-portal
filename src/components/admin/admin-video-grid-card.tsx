"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoPosterSurface } from "@/components/ui/video-poster-surface";
import { VideoReviewAdminActions } from "@/components/admin/video-review-admin-actions";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import { videoDurationBadge } from "@/lib/video-duration";
import { cn } from "@/lib/utils";

function ThumbnailOverlayAction({
  label,
  onClick,
  className,
  children,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "absolute z-20 flex h-11 w-11 items-center justify-center rounded-lg",
        "bg-black/60 text-white shadow-md ring-1 ring-white/20 backdrop-blur-[2px]",
        "transition hover:bg-black/75 active:scale-[0.97]",
        tone === "danger" && "hover:bg-red-950/80",
        className
      )}
    >
      {children}
    </button>
  );
}

export type AdminVideoGridCardProps = {
  video: MediaAsset;
  thumbUrl?: string | null;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
  badge: string;
  onToggleVisibility: () => void;
  visibleToClient: boolean;
  onSetHero: () => void;
  isEditing: boolean;
  editTitle: string;
  editYoutubeUrl: string;
  onEditTitleChange: (value: string) => void;
  onEditYoutubeUrlChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  projectId: string;
  reviewItem: VideoReviewListItem | null;
  onReviewsChange: () => void;
};

/** Admin project video tile — thumbnail overlays, wrapped controls, review block. */
export function AdminVideoGridCard({
  video,
  thumbUrl,
  onPlay,
  onEdit,
  onDelete,
  onUp,
  onDown,
  canUp,
  canDown,
  badge,
  onToggleVisibility,
  visibleToClient,
  onSetHero,
  isEditing,
  editTitle,
  editYoutubeUrl,
  onEditTitleChange,
  onEditYoutubeUrlChange,
  onSaveEdit,
  onCancelEdit,
  projectId,
  reviewItem,
  onReviewsChange,
}: AdminVideoGridCardProps) {
  const title = mediaDisplayName(video);
  const duration = videoDurationBadge(video);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm ring-1 ring-black/[0.04]">
      <div className="relative aspect-video min-w-0 shrink-0 overflow-hidden bg-slate-900">
        <VideoPosterSurface
          asset={video}
          thumbUrl={thumbUrl}
          className="absolute inset-0"
          imageClassName="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/25" />

        <ThumbnailOverlayAction label={`Rename ${title}`} onClick={onEdit} className="left-1.5 top-1.5">
          <Pencil className="h-4 w-4" strokeWidth={2.25} />
        </ThumbnailOverlayAction>

        <ThumbnailOverlayAction
          label={`Delete ${title}`}
          onClick={onDelete}
          tone="danger"
          className="right-1.5 top-1.5"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </ThumbnailOverlayAction>

        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 z-10 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 shadow-lg ring-2 ring-white/25 transition hover:scale-105 hover:bg-red-600 sm:h-14 sm:w-14">
            <Play className="ml-0.5 h-5 w-5 text-white sm:h-6 sm:w-6" fill="currentColor" />
          </span>
        </button>

        {duration ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white bg-black/85">
            {duration}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 px-3 pt-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-primary">{title}</h3>
      </div>

      {isEditing ? (
        <div className="min-w-0 space-y-2 border-t border-border/60 px-3 py-2.5">
          <Input
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            placeholder="Title"
            maxLength={120}
            className="min-h-10"
          />
          {video.media_source === "youtube" && (
            <Input
              value={editYoutubeUrl}
              onChange={(e) => onEditYoutubeUrlChange(e.target.value)}
              placeholder="YouTube URL"
              className="min-h-10"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="accent" className="min-h-10" onClick={onSaveEdit}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-w-0 border-t border-border/60 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <div className="flex shrink-0 items-center rounded-md border border-border/80 bg-muted/30">
              <button
                type="button"
                aria-label="Move up"
                disabled={!canUp}
                onClick={onUp}
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <span className="h-5 w-px bg-border/80" aria-hidden />
              <button
                type="button"
                aria-label="Move down"
                disabled={!canDown}
                onClick={onDown}
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {badge}
            </span>

            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-9 px-2 text-xs"
                title={visibleToClient ? "Hide from client" : "Show to client"}
                onClick={onToggleVisibility}
              >
                {visibleToClient ? (
                  <EyeOff className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Eye className="mr-1 h-3.5 w-3.5" />
                )}
                {visibleToClient ? "Hide" : "Show"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-9 px-2 text-xs"
                onClick={onSetHero}
              >
                Set as Hero
              </Button>
            </div>
          </div>
        </div>
      )}

      {video.media_source !== "youtube" && (
        <div className="min-w-0 border-t border-border/60 bg-muted/10 px-3 py-2.5">
          <VideoReviewAdminActions
            embedded
            projectId={projectId}
            video={video}
            reviewItem={reviewItem}
            onReviewsChange={onReviewsChange}
          />
        </div>
      )}
    </article>
  );
}
