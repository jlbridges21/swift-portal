"use client";

import { Search, Star, X } from "lucide-react";
import { DEMO_MEDIA } from "./demo-data";

/** CSS gradient “photos” — no stock imagery, no remote assets. */
const SWATCHES = [
  "linear-gradient(145deg,#1e293b 0%,#475569 45%,#94a3b8 100%)",
  "linear-gradient(160deg,#0f172a 0%,#312e81 50%,#6366f1 100%)",
  "linear-gradient(135deg,#44403c 0%,#a8a29e 55%,#f5f5f4 100%)",
  "linear-gradient(150deg,#1c1917 0%,#78716c 40%,#d6d3d1 100%)",
  "linear-gradient(140deg,#164e63 0%,#0e7490 50%,#67e8f9 100%)",
  "linear-gradient(155deg,#312e81 0%,#4f46e5 45%,#a5b4fc 100%)",
] as const;

export function DemoMediaPanel({
  phase,
}: {
  phase: "idle" | "select" | "lightbox";
}) {
  const selectedId = phase === "idle" ? null : "ph2";
  const lightboxOpen = phase === "lightbox";

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-3 py-2.5">
        <div className="relative min-w-[140px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" aria-hidden />
          <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-8 pr-2 text-xs text-[#94A3B8]">
            Search media…
          </div>
        </div>
        <span className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B]">
          Photos
        </span>
        <span className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B]">
          Folders
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-[#E2E8F0] px-3 py-2">
        {["All", "Exteriors", "Interiors", "Aerial"].map((f, i) => (
          <span
            key={f}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              i === 0 ? "bg-[#4F46E5] text-white" : "bg-[#F1F5F9] text-[#64748B]"
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2 overflow-hidden p-3 sm:grid-cols-3">
        {DEMO_MEDIA.map((asset, i) => {
          const selected = selectedId === asset.id;
          return (
            <div
              key={asset.id}
              data-demo-target={selected ? "media-card" : undefined}
              className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                selected ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/30" : "border-[#E2E8F0]"
              }`}
            >
              <div
                className="relative aspect-[4/3]"
                style={{ background: SWATCHES[i % SWATCHES.length] }}
              >
                {i === 1 ? (
                  <Star className="absolute right-2 top-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                ) : null}
                <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  {asset.folder}
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-[#0F172A]">{asset.title}</p>
                <p className="truncate text-[10px] text-[#94A3B8]">412 Riverbend Lane · Maya Ortiz</p>
              </div>
            </div>
          );
        })}
      </div>

      {lightboxOpen ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#0F172A]/75 p-6"
          data-demo-target="lightbox"
          role="presentation"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl">
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
              aria-hidden
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className="aspect-[4/3] w-full"
              style={{ background: SWATCHES[1] }}
            />
            <div className="px-4 py-3 text-white">
              <p className="text-sm font-semibold">Dusk aerial</p>
              <p className="text-xs text-white/70">Aerial · 412 Riverbend Lane</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
