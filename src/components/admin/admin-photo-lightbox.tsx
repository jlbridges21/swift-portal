"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SafeAreaCloseButton } from "@/components/ui/safe-area-close-button";
import { MediaThumbnailSkeleton } from "@/components/ui/skeleton";
import { RemoteImage } from "@/components/ui/remote-image";
import type { MediaAsset } from "@/lib/types";
import { Download, Loader2, SlidersHorizontal } from "lucide-react";
import { mediaDisplayName } from "@/lib/media-display-name";
import { downloadMediaAsset } from "@/lib/download";
import { isEditablePhotoAsset } from "@/lib/photo-editor/shared";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
import type { DownloadQuality } from "@/lib/download-quality";

interface AdminPhotoLightboxProps {
  photo: MediaAsset;
  onClose: () => void;
  /** Opens this photo in the Photo Editor. Omitted when the user can't edit photos. */
  onEdit?: () => void;
  editOpening?: boolean;
}

export function AdminPhotoLightbox({ photo, onClose, onEdit, editOpening }: AdminPhotoLightboxProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/media/download/${photo.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.url) setUrl(d.url);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <SafeAreaCloseButton onClick={onClose} />

      <div
        className="flex items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <span className="flex min-w-0 items-center gap-2 pr-14 text-sm text-white/80">
          <span className="truncate">{mediaDisplayName(photo)}</span>
          {photo.edit_status === "edited" ? (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">Edited</span>
          ) : null}
        </span>
        <div className="flex shrink-0 gap-2">
          {onEdit && isEditablePhotoAsset(photo) ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={onEdit}
              disabled={editOpening}
            >
              {editOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
              Edit Photo
            </Button>
          ) : null}
          {url && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setQualityOpen(true)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden px-2">
        {url ? (
          <RemoteImage
            src={url}
            alt={photo.alt_text || mediaDisplayName(photo)}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <MediaThumbnailSkeleton className="h-48 w-64 rounded-xl bg-white/10" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            Preview unavailable
          </div>
        )}
      </div>

      <DownloadQualityDialog
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
        title="Download photo"
        onConfirm={(quality: DownloadQuality) => {
          void downloadMediaAsset(photo, { quality });
        }}
      />
    </div>
  );
}
