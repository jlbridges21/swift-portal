"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadEstimatePdf, renderEstimatePdf } from "@/components/projects/estimate-pdf-client";
import { estimateReference, type EstimatePdfInput } from "@/lib/estimate-pdf";
import { Button } from "@/components/ui/button";

const PREVIEW_DELAY_MS = 300;

export function EstimatePdfPreview({
  input,
  logoUrl,
}: {
  input: EstimatePdfInput;
  logoUrl: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const current = generation.current + 1;
    generation.current = current;
    const timer = window.setTimeout(() => {
      void renderEstimatePdf(input, logoUrl)
        .then((bytes) => {
          if (generation.current !== current) return;
          const copy = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(copy).set(bytes);
          const next = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
          const previous = urlRef.current;
          urlRef.current = next;
          setUrl(next);
          setError(null);
          if (previous) URL.revokeObjectURL(previous);
        })
        .catch(() => {
          if (generation.current !== current) return;
          setError("The preview couldn't be updated. You can still save or send this estimate.");
        });
    }, PREVIEW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      generation.current += 1;
    };
  }, [input, logoUrl]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return (
    <div className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-black/[0.06]">
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preview</p>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
      {url ? (
        <iframe title="Estimate PDF preview" src={url} className="h-[70vh] min-h-[420px] w-full bg-white lg:h-[640px]" />
      ) : (
        <p className="px-4 py-8 text-sm text-slate-500">
          {error ? "Preview unavailable." : "Preparing preview…"}
        </p>
      )}
    </div>
  );
}

export function DownloadEstimatePdfButton({
  input,
  logoUrl,
  className,
}: {
  input: EstimatePdfInput;
  logoUrl: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!input.quoteId || busy) return;
    setBusy(true);
    try {
      const bytes = await renderEstimatePdf(input, logoUrl);
      downloadEstimatePdf(bytes, `${estimateReference(input.quoteId)}.pdf`);
    } catch {
      toast.error("Could not create the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} disabled={busy} onClick={() => void download()}>
      <Download className="h-4 w-4" /> {busy ? "Preparing…" : "Download PDF"}
    </Button>
  );
}
