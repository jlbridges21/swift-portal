"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SafeAreaCloseButton } from "@/components/ui/safe-area-close-button";
import { MediaThumbnailSkeleton } from "@/components/ui/skeleton";
import { PropertyLineToolButton } from "@/components/admin/property-line-tool-button";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Download, Pencil } from "lucide-react";
import { toast } from "sonner";

interface AdminPhotoLightboxProps {
  photo: MediaAsset;
  onClose: () => void;
  onSavedPropertyLine?: (asset: Record<string, unknown>) => void;
}

export function AdminPhotoLightbox({ photo, onClose, onSavedPropertyLine }: AdminPhotoLightboxProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

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
        <span className="min-w-0 truncate text-sm text-white/80 pr-14">
          {photo.title || photo.file_name}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={() => setEditing((e) => !e)}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          {url && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/media/download/${photo.id}?file=1`;
                a.download = photo.file_name;
                a.click();
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden px-2">
        {url ? (
          <Image
            src={url}
            alt={photo.alt_text || photo.file_name}
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

      {editing && (
        <div
          className={cn(
            "shrink-0 border-t border-white/10 bg-slate-900/95 px-4 py-4 space-y-3",
            "pb-[max(1rem,env(safe-area-inset-bottom))]"
          )}
        >
          <p className="text-sm font-medium text-white">Edit tools</p>
          <PropertyLineToolButton
            mediaId={photo.id}
            fileName={photo.file_name}
            title={photo.title || photo.file_name}
            projectId={photo.project_id}
            onSaved={(asset) => {
              toast.success("Property line image saved to project");
              onSavedPropertyLine?.(asset);
            }}
          />
        </div>
      )}
    </div>
  );
}
