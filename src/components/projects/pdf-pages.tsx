"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js loads on first use only; the worker ships from node_modules through the bundler. */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist")
      .then((pdfjs) => {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
        }
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

/**
 * Renders PDF bytes as white pages on a neutral canvas, each page fit to the
 * column width. The previous render stays on screen until the next one is
 * ready, so typing in the editor never flashes an empty preview.
 */
export function PdfPages({
  bytes,
  label,
  className,
  onRendered,
  onError,
}: {
  bytes: Uint8Array | null;
  label: string;
  className?: string;
  onRendered?: (pageCount: number) => void;
  onError?: (error: unknown) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const callbacks = useRef({ onRendered, onError });
  useEffect(() => {
    callbacks.current = { onRendered, onError };
  }, [onRendered, onError]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let timer: number | undefined;
    const measure = () => {
      const next = Math.floor(frame.clientWidth);
      window.clearTimeout(timer);
      // Resizes settle before re-rendering every page.
      timer = window.setTimeout(() => setWidth((prev) => (Math.abs(prev - next) > 2 ? next : prev)), 120);
    };
    setWidth(Math.floor(frame.clientWidth));
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const host = pagesRef.current;
    if (!bytes || !host || width <= 0) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        // getDocument transfers the buffer to the worker; keep the caller's bytes intact.
        const task = pdfjs.getDocument({ data: bytes.slice() });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvases: HTMLCanvasElement[] = [];
        for (let number = 1; number <= doc.numPages; number++) {
          const page = await doc.getPage(number);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label}, page ${number} of ${doc.numPages}`);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        if (cancelled) return;
        host.replaceChildren(
          ...canvases.map((canvas) => {
            const sheet = document.createElement("div");
            sheet.className =
              "overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.04]";
            sheet.appendChild(canvas);
            return sheet;
          })
        );
        callbacks.current.onRendered?.(doc.numPages);
      } catch (error) {
        if (!cancelled) callbacks.current.onError?.(error);
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [bytes, width, label]);

  return (
    <div ref={frameRef} className={cn("w-full", className)}>
      <div ref={pagesRef} className="flex flex-col gap-4" />
    </div>
  );
}
