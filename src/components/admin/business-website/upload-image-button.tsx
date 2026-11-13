"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IMAGE_UPLOAD_ACCEPT,
  imageOptimizationErrorMessage,
  optimizeImageForUpload,
} from "@/lib/optimize-upload-image";

/**
 * "Upload photo" from the computer — same endpoint as the other website image uploads.
 * Large photos are optimized in the browser first (see optimizeImageForUpload) so they fit
 * the route's 4MB cap; the server still validates type and size and resizes again.
 */
export function UploadImageButton({ label = "Upload photo", onUploaded }: { label?: string; onUploaded: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");

  async function upload(original: File) {
    setPhase("optimizing");
    try {
      let file: File;
      try {
        file = (await optimizeImageForUpload(original)).file;
      } catch (e) {
        toast.error(imageOptimizationErrorMessage(e));
        return;
      }
      setPhase("uploading");
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "heroImage");
      const res = await fetch("/api/admin/settings/logo", { method: "POST", credentials: "include", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      onUploaded(data.url);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhase("idle");
      if (input.current) input.current.value = "";
    }
  }

  const busy = phase !== "idle";
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{" "}
        {phase === "optimizing" ? "Optimizing image…" : phase === "uploading" ? "Uploading…" : label}
      </Button>
    </>
  );
}
