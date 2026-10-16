"use client";

import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { trackEngagement } from "@/lib/analytics/engagement";
import { cn } from "@/lib/utils";

const ICON = { pdf: FileText, docx: FileType2, xlsx: FileSpreadsheet } as const;

function size(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** A real download link (works without JavaScript); the click is recorded as an engagement event. */
export function DownloadButton({
  resourceId,
  file,
  primary,
}: {
  resourceId: string;
  file: { format: "pdf" | "docx" | "xlsx"; href: string; filename: string; bytes: number; pages?: number; label: string };
  primary?: boolean;
}) {
  const Icon = ICON[file.format];
  return (
    <a
      href={file.href}
      download={file.filename}
      onClick={() => trackEngagement(`resource:${resourceId}:${file.format}`, { once: false })}
      className={cn(
        "group flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
        primary ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA]" : "border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/50"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", primary ? "text-white" : "text-[#4F46E5]")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{file.label}</span>
        <span className={cn("block text-xs", primary ? "text-indigo-100" : "text-[#64748B]")}>
          {file.format.toUpperCase()} · {size(file.bytes)}
          {file.pages ? ` · ${file.pages} ${file.pages === 1 ? "page" : "pages"}` : ""}
        </span>
      </span>
      <Download className={cn("h-4 w-4 shrink-0 transition-transform group-hover:translate-y-0.5", primary ? "text-white" : "text-[#4F46E5]")} aria-hidden />
    </a>
  );
}
