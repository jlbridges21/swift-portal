"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type BrandAssetKind = "logo" | "emailLogo" | "favicon" | "heroImage";

const MAX_BYTES = 4 * 1024 * 1024;

const KIND_UI: Record<
  BrandAssetKind,
  { label: string; accept: string; hint: string; types: Set<string>; extraExt: Set<string> }
> = {
  logo: {
    label: "Logo",
    accept: "image/png,image/jpeg,image/webp",
    hint: "PNG, JPEG, or WebP, under 4MB. You can also paste a link to a logo already hosted online.",
    types: new Set(["image/png", "image/jpeg", "image/webp"]),
    extraExt: new Set(),
  },
  emailLogo: {
    label: "Email logo",
    accept: "image/png,image/jpeg,image/webp",
    hint: "Shown at the top of notification emails. PNG, JPEG, or WebP, under 4MB.",
    types: new Set(["image/png", "image/jpeg", "image/webp"]),
    extraExt: new Set(),
  },
  favicon: {
    label: "Favicon",
    accept: "image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,.ico,.png,.svg",
    hint: "Browser tab icon. PNG, ICO, or SVG, under 4MB. Square 32×32 or 48×48 recommended (192×192 also works).",
    types: new Set(["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml", "image/webp"]),
    extraExt: new Set(["ico", "svg", "png", "webp"]),
  },
  heroImage: {
    label: "Hero image",
    accept: "image/png,image/jpeg,image/webp",
    hint: "PNG, JPEG, or WebP, under 4MB. Oversized images are resized. You can also paste an https URL.",
    types: new Set(["image/png", "image/jpeg", "image/webp"]),
    extraExt: new Set(),
  },
};

async function parseApiResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new Error(`Request failed with HTTP ${res.status}`);
    }
    if (!res.ok) {
      const message = typeof data.error === "string" && data.error.trim() ? data.error : null;
      throw new Error(message || `Request failed with HTTP ${res.status}`);
    }
    return data;
  }

  const text = (await res.text()).trim().replace(/\s+/g, " ").slice(0, 180);
  throw new Error(
    text
      ? `Request failed with HTTP ${res.status}: ${text}`
      : `Request failed with HTTP ${res.status}`
  );
}

export function BrandAssetField({
  kind,
  value,
  inputId,
  onUrlChange,
  onUploaded,
}: {
  kind: BrandAssetKind;
  value: string;
  inputId: string;
  onUrlChange: (url: string) => void;
  onUploaded?: (url: string) => void;
}) {
  const router = useRouter();
  const ui = KIND_UI[kind];
  const fileInputId = `${inputId}-file`;

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={inputId}>{ui.label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input id={inputId} value={value} onChange={(e) => onUrlChange(e.target.value)} />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          Upload {ui.label.toLowerCase()}
        </Button>
        <input
          id={fileInputId}
          type="file"
          accept={ui.accept}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (!ui.types.has(file.type) && !ui.extraExt.has(ext)) {
              toast.error(
                kind === "favicon"
                  ? "Favicon must be a PNG, ICO, or SVG file."
                  : `${ui.label} must be a PNG, JPEG, or WebP image.`
              );
              return;
            }
            if (file.size > MAX_BYTES) {
              toast.error(`${ui.label} must be under 4MB.`);
              return;
            }
            const form = new FormData();
            form.append("file", file);
            form.append("kind", kind);
            try {
              const res = await fetch("/api/admin/settings/logo", {
                method: "POST",
                credentials: "include",
                body: form,
              });
              const data = await parseApiResponse(res);
              const url = typeof data.url === "string" ? data.url : "";
              if (!url) throw new Error("Upload failed");
              onUrlChange(url);
              onUploaded?.(url);
              toast.success(`${ui.label} uploaded`);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Upload failed");
            }
          }}
        />
      </div>
      <p className="text-xs text-muted">{ui.hint}</p>
    </div>
  );
}
