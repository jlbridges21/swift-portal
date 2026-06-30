"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Calendar, Eye, CreditCard, Images,
} from "lucide-react";
import { normalizeStatus } from "@/lib/constants";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { ProjectZipDownload } from "@/components/projects/project-zip-download";

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
  const s = normalizeStatus(status);
  const canPreview = hasMedia;
  const canDownload = canDownloadDeliverables(s);

  const actions = [
    {
      id: "schedule",
      label: "Schedule",
      href: "#scheduling",
      icon: Calendar,
      show: ["proposal_approved", "scheduled"].includes(s),
    },
    {
      id: "review",
      label: "Review",
      href: s === "ready_for_review" ? "#deliverable-review" : "#photo-gallery",
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
        "flex flex-wrap items-start gap-2 sm:gap-3",
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
      {showDownload && projectId && (
        <ProjectZipDownload projectId={projectId} variant="hero" />
      )}
      {canPreview && !canDownload && hasMedia && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs text-slate-300">
          <Images className="h-3.5 w-3.5" /> Downloads unlock after payment
        </span>
      )}
    </nav>
  );
}
