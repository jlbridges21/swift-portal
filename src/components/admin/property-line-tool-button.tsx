"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PenLine } from "lucide-react";
import { PropertyLineEditor } from "@/components/admin/property-line-editor";
import { toast } from "sonner";

export interface PropertyLineToolButtonProps {
  mediaId: string;
  fileName: string;
  title: string;
  projectId: string | null;
  disabled?: boolean;
  onSaved?: (asset: Record<string, unknown>) => void;
}

export function PropertyLineToolButton({
  mediaId,
  fileName,
  title,
  projectId,
  disabled,
  onSaved,
}: PropertyLineToolButtonProps) {
  const [open, setOpen] = useState(false);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoadingUrl(true);
    setUrlError(null);
    setFullUrl(null);

    fetch(`/api/media/download/${mediaId}?file=1`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Could not load full-resolution image.");
        }
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFullUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setUrlError(err instanceof Error ? err.message : "Could not load full-resolution image.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUrl(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, mediaId]);

  function handleOpen() {
    setOpen(true);
  }

  function handleSaved(asset: Record<string, unknown>) {
    toast.success("Property line image saved");
    onSaved?.(asset);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 w-full justify-start"
        onClick={handleOpen}
        disabled={disabled}
      >
        <PenLine className="h-4 w-4" /> Property Line Tool
      </Button>

      {open && (
        <>
          {loadingUrl && (
            <div className="fixed inset-0 z-[299] flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading full image…</p>
              </div>
            </div>
          )}

          {urlError && !loadingUrl && (
            <div className="fixed inset-0 z-[299] flex items-center justify-center bg-black/80 px-6">
              <div className="max-w-sm space-y-4 rounded-xl bg-white p-6 text-center text-primary shadow-lg">
                <p className="text-sm text-red-600">{urlError}</p>
                <Button variant="accent" className="min-h-11 w-full" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {fullUrl && !loadingUrl && (
            <PropertyLineEditor
              imageUrl={fullUrl}
              fileName={fileName}
              title={title}
              projectId={projectId}
              onClose={() => setOpen(false)}
              onSaved={handleSaved}
            />
          )}
        </>
      )}
    </>
  );
}
