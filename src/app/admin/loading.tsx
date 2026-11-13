"use client";

import { Header } from "@/components/layout/header";
import { PageLoadingSkeleton } from "@/components/layout/page-loading-skeleton";
import { useAdminCapabilities } from "@/components/admin/admin-capabilities-context";

/**
 * Admin route loading boundary. The admin layout (sidebar / top bar in the New interface)
 * stays mounted; only the page area shows this placeholder. Classic pages render their own
 * top Header, so the placeholder renders it too (Header steps aside inside the New shell).
 */
export default function AdminLoading() {
  const { userRole } = useAdminCapabilities();
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={userRole === "staff" ? "staff" : "admin"} />
      <PageLoadingSkeleton />
    </div>
  );
}
