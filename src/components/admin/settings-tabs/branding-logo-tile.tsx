"use client";

import { useState } from "react";
import { ImageIcon, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBrandAssetUpload, type BrandAssetKind } from "@/components/admin/brand-asset-field";

const CHECKERBOARD =
  "repeating-conic-gradient(var(--color-subtle) 0 25%, var(--color-card) 0 50%) 0 0 / 16px 16px";

/**
 * One picture tile in the Logos card: checkerboard preview, name, one-line hint, Replace / Remove.
 * The raw URL field stays tucked behind "Use a link instead".
 */
export function BrandingLogoTile({
  kind,
  inputId,
  title,
  hint,
  value,
  onUrlChange,
  onLogoMeasured,
  linked = false,
  linkedHint,
  square = false,
}: {
  kind: BrandAssetKind;
  inputId: string;
  title: string;
  hint: string;
  value: string;
  onUrlChange: (url: string) => void;
  onLogoMeasured?: (logoLuminance: number | null) => void;
  /** Email logo that simply follows the portal logo. */
  linked?: boolean;
  linkedHint?: string;
  square?: boolean;
}) {
  const [showLink, setShowLink] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const { phase, busy, fileInput, openPicker } = useBrandAssetUpload({
    kind,
    inputId,
    onUrlChange,
    onLogoMeasured,
  });
  const src = value.trim();
  const hasImage = Boolean(src) && broken !== src;

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        aria-label={`${src ? "Replace" : "Upload"} ${title.toLowerCase()}`}
        className="grid h-24 place-items-center overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ background: CHECKERBOARD }}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant URL; domain allowlist unknown
          <img
            src={src}
            alt=""
            className={cn("max-h-16 max-w-[85%] object-contain", square && "h-12 w-12")}
            onError={() => setBroken(src)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted">
            <ImageIcon className="h-5 w-5" aria-hidden />
            {src ? "Can't load image" : "No image yet"}
          </span>
        )}
      </button>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading">{title}</p>
        <p className="truncate text-[13px] text-muted" title={linked && linkedHint ? linkedHint : hint}>
          {linked && linkedHint ? linkedHint : hint}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-3"
          disabled={busy}
          aria-busy={busy}
          onClick={openPicker}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {phase === "optimizing" ? "Optimizing…" : phase === "uploading" ? "Uploading…" : src ? "Replace" : "Upload"}
        </Button>
        {linked ? (
          <span
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted"
            title="Follows your portal logo. Upload to use a different one."
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Linked
          </span>
        ) : src ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 px-0 text-red-700 surface-dark:text-red-300"
            aria-label={`Remove ${title.toLowerCase()}`}
            title="Remove"
            onClick={() => onUrlChange("")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {fileInput}
      </div>
      {showLink ? (
        <div className="space-y-1">
          <label htmlFor={inputId} className="text-xs font-medium text-muted">
            Image link
          </label>
          <Input
            id={inputId}
            value={value}
            placeholder="https://"
            className="h-9 text-xs"
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowLink(true)}
          className="-mt-1 inline-flex min-h-8 items-center gap-1 self-start text-xs font-medium text-muted hover:text-accent"
        >
          <Link2 className="h-3 w-3" aria-hidden /> Use a link instead
        </button>
      )}
    </div>
  );
}
