import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { AdminMessagesInbox } from "@/components/admin/admin-messages-inbox";

export default async function AdminMessagesPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="p-8 text-sm text-muted">Loading messages…</div>}>
          <AdminMessagesInbox />
        </Suspense>
      </main>
    </div>
  );
}
