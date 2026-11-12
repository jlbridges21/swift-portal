"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadEstimatePdf, renderEstimatePdf } from "@/components/projects/estimate-pdf-client";
import { estimateReference, type EstimatePdfInput } from "@/lib/estimate-pdf";
import { Button } from "@/components/ui/button";
import { PdfPages } from "@/components/projects/pdf-pages";
import { cn } from "@/lib/utils";

const PREVIEW_DELAY_MS = 300;

/**
 * Live document preview of the exact PDF the server sends (same builder, same
 * fonts). Pages render to canvases with pdf.js: no browser PDF chrome.
 */
export function EstimatePdfPreview({
  input,
  logoUrl,
  className,
}: {
  input: EstimatePdfInput;
  logoUrl: string;
  className?: string;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pending, setPending] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const current = generation.current + 1;
    generation.current = current;
    setPending(true);
    const timer = window.setTimeout(() => {
      void renderEstimatePdf(input, logoUrl)
        .then((next) => {
          if (generation.current !== current) return;
          setBytes(next);
          setError(null);
        })
        .catch(() => {
          if (generation.current !== current) return;
          setPending(false);
          setError("The preview couldn't be updated. You can still save or send this proposal.");
        });
    }, PREVIEW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      generation.current += 1;
    };
  }, [input, logoUrl]);

  const onRendered = useCallback((pages: number) => {
    setPageCount(pages);
    setPending(false);
  }, []);
  const onRenderError = useCallback(() => {
    setPending(false);
    setError("The preview couldn't be drawn. You can still save or send this proposal.");
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-black/[0.06] surface-dark:bg-slate-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] bg-white/80 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Preview{pageCount > 1 ? ` · ${pageCount} pages` : ""}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : pending && bytes ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Updating…
            </>
          ) : bytes ? (
            "Matches the PDF your client receives"
          ) : null}
        </p>
      </div>
      <div className="max-h-[75vh] min-h-[320px] overflow-y-auto overscroll-contain p-4 sm:p-6 lg:max-h-[calc(100dvh-10rem)]">
        {!bytes && (
          <div className="mx-auto aspect-[8.5/11] w-full animate-pulse rounded-[3px] bg-white/70 shadow-sm" aria-hidden />
        )}
        <PdfPages
          bytes={bytes}
          label="Proposal preview"
          className={cn("mx-auto transition-opacity", pending && bytes ? "opacity-80" : "opacity-100")}
          onRendered={onRendered}
          onError={onRenderError}
        />
        {!bytes && (
          <p className="sr-only">{error ? "Preview unavailable." : "Preparing preview…"}</p>
        )}
      </div>
    </div>
  );
}

export function DownloadEstimatePdfButton({
  input,
  logoUrl,
  className,
  preferStoredCopy = false,
}: {
  input: EstimatePdfInput;
  logoUrl: string;
  className?: string;
  /** Business view of a sent proposal: download the copy stored when it was sent. */
  preferStoredCopy?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!input.quoteId || busy) return;
    setBusy(true);
    try {
      const stored = preferStoredCopy ? await fetchStoredProposalPdf(input.quoteId) : null;
      const bytes = stored ?? (await renderEstimatePdf(input, logoUrl));
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

/** The immutable PDF stored when the proposal was sent, or null (legacy / never sent). */
export async function fetchStoredProposalPdf(quoteId: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/pdf`, { credentials: "include" });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}
