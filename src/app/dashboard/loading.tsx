"use client";

import { Header } from "@/components/layout/header";
import { PageLoadingSkeleton } from "@/components/layout/page-loading-skeleton";
import { usePortalViewer } from "@/components/dashboard/portal-viewer-context";

/** Client portal loading boundary: same Header as the pages, content placeholder below. */
export default function DashboardLoading() {
  const viewer = usePortalViewer();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white surface-dark:from-background surface-dark:to-background">
      <Header variant="dashboard" userRole="client" userName={viewer?.name} userAvatar={viewer?.avatarUrl} />
      <PageLoadingSkeleton containerClassName="mobile-container py-10" />
    </div>
  );
}
