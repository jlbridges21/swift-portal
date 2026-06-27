"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Calendar, Eye, CreditCard, Download, Images, Loader2,
} from "lucide-react";
import { normalizeStatus } from "@/lib/constants";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { toast } from "sonner";

interface QuickActionsProps {
  status: string;
  hasPendingPayment: boolean;
  hasMedia: boolean;
  projectId?: string;
  className?: string;
}

export function ProjectQuickActions({
  status,
  hasPendingPayment,
  hasMedia,
  projectId,
  className,
}: QuickActionsProps) {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const s = normalizeStatus(status);
  const canPreview = hasMedia;
  const canDownload = canDownloadDeliverables(s);

  async function handleDownloadZip() {
    if (!projectId || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/download-zip`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Download failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "deliverables.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingZip(false);
    }
  }

  const actions = [
    {
      id: "schedule",
      label: "Schedule",
      href: "#scheduling",
      icon: Calendar,
      show: ["proposal_approved", "scheduled", "quote_sent"].includes(s) || s === "new_request",
    },
    {
      id: "review",
      label: "Review",
      href: "#deliverables",
      icon: Eye,
      show: canPreview && hasMedia,
    },
    {
      id: "pay",
      label: "Pay",
      href: "#payments",
      icon: CreditCard,
      show: hasPendingPayment || s === "awaiting_payment",
    },
  ].filter((a) => a.show);

  const showDownload = canDownload && hasMedia && !!projectId;

  if (!actions.length && !showDownload) return null;

  return (
    <nav
      className={cn(
        "flex flex-wrap gap-2 sm:gap-3",
        className
      )}
      aria-label="Quick actions"
    >
      {actions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/30"
        >
          <action.icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
          {action.label}
        </Link>
      ))}
      {showDownload && (
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/30 disabled:opacity-60"
        >
          {downloadingZip ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4 opacity-80 group-hover:opacity-100" />
          )}
          {downloadingZip ? "Preparing ZIP..." : "Download All"}
        </button>
      )}
      {canPreview && !canDownload && hasMedia && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs text-slate-300">
          <Images className="h-3.5 w-3.5" /> Preview mode
        </span>
      )}
    </nav>
  );
}
