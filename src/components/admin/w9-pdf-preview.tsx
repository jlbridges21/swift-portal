"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TaxInformationSettings } from "@/lib/w9-fields";

type SignatureMode = "typed" | "blank";

/**
 * Debounced preview of the official form. The request body is the tax lines
 * and the signature choice. It does not include a taxpayer identification number.
 */
export function W9PdfPreview({
  tax,
  signatureMode,
  typedName,
}: {
  tax: TaxInformationSettings;
  signatureMode: SignatureMode;
  typedName: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPending(true);
      void (async () => {
        try {
          const res = await fetch("/api/admin/w9/preview", {
            method: "POST",
            credentials: "include",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tax,
              signatureMode,
              typedName: signatureMode === "typed" ? typedName : "",
            }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error || "Could not preview the form.");
          }
          const blob = await res.blob();
          if (controller.signal.aborted) return;
          const next = URL.createObjectURL(blob);
          setUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return next;
          });
          setError(null);
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Could not preview the form.");
        } finally {
          if (!controller.signal.aborted) setPending(false);
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [tax, signatureMode, typedName]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <p className="text-xs text-muted">
            The SSN and EIN boxes stay empty. The number is added when you generate the form.
          </p>
        </div>
        {pending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" /> : null}
      </div>
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
      <div className="min-h-0 min-w-0 flex-1">
        {url ? (
          <iframe
            title="W-9 preview"
            src={url}
            className="h-full min-h-[70dvh] w-full min-w-0 border-0 bg-white lg:min-h-0"
          />
        ) : (
          <div className="flex h-full min-h-[40dvh] items-center justify-center text-sm text-muted">
            Preparing the form…
          </div>
        )}
      </div>
    </div>
  );
}
