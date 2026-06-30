import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { ClientsTable } from "@/components/admin/clients-table";
import { getClientListRows } from "@/lib/clients-crm";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { view } = await searchParams;
  const showDeleted = view === "deleted";
  const rows = await getClientListRows({ includeDeleted: showDeleted });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title={showDeleted ? "Hidden Clients" : "Clients"}
          description={`${rows.length} ${showDeleted ? "hidden" : "active"} client${rows.length === 1 ? "" : "s"}`}
        >
          {!showDeleted && (
            <Link href="/admin/clients/new">
              <Button variant="accent" size="sm">
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            </Link>
          )}
        </PageHeader>

        <ClientsTable clients={rows} showDeleted={showDeleted} />
      </main>
    </div>
  );
}
