"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DOWNLOAD_QUALITY_PHOTOS_ONLY_NOTE,
  MLS_LONG_EDGE,
  MLS_OVERSIZE_DISCLOSURE,
  type DownloadQuality,
} from "@/lib/download-quality";

interface DownloadQualityDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Called when the user confirms a quality. */
  onConfirm: (quality: DownloadQuality) => void;
  /** When true, show ZIP-oriented copy (photos resized; other media as-is). */
  zipMode?: boolean;
  confirmLabel?: string;
  className?: string;
}

export function DownloadQualityDialog({
  open,
  onClose,
  title = "Download quality",
  onConfirm,
  zipMode = false,
  confirmLabel = "Download",
  className,
}: DownloadQualityDialogProps) {
  const [quality, setQuality] = useState<DownloadQuality>("print");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={cn("max-w-md", className)}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              onConfirm(quality);
              onClose();
            }}
          >
            <Download className="h-4 w-4" />
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="sr-only">Choose download quality</legend>
          <QualityOption
            id="quality-print"
            name="download-quality"
            checked={quality === "print"}
            onChange={() => setQuality("print")}
            label="Print (original)"
            description="Full-resolution original files — best for print and archival."
          />
          <QualityOption
            id="quality-mls"
            name="download-quality"
            checked={quality === "mls"}
            onChange={() => setQuality("mls")}
            label={`MLS (${MLS_LONG_EDGE}px long edge)`}
            description={`Photos resized to ${MLS_LONG_EDGE}px on the long edge for listing sites. Aspect ratio preserved.`}
          />
        </fieldset>

        <p className="text-xs text-muted leading-relaxed">
          {DOWNLOAD_QUALITY_PHOTOS_ONLY_NOTE}
          {zipMode ? " Non-photo files in this archive are unchanged." : ""}
        </p>
        <p className="text-xs text-muted leading-relaxed">{MLS_OVERSIZE_DISCLOSURE}</p>
      </div>
    </Modal>
  );
}

function QualityOption({
  id,
  name,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-accent bg-accent/5" : "border-border hover:bg-slate-50"
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0 accent-(--accent)"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-muted leading-relaxed">{description}</span>
      </span>
    </label>
  );
}
