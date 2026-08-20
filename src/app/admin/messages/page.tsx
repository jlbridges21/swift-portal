import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin-access";
import { Header } from "@/components/layout/header";
import { AdminMessagesInbox } from "@/components/admin/admin-messages-inbox";

export default async function AdminMessagesPage() {
  await requireAdminPage();

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
