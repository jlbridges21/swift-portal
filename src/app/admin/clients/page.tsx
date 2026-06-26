import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { ClientsTable } from "@/components/admin/clients-table";
import { getClientListRows } from "@/lib/clients-crm";

export default async function AdminClientsPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const rows = await getClientListRows();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Clients" description={`${rows.length} total clients`}>
          <Link href="/admin/clients/new">
            <Button variant="accent" size="sm">
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </Link>
        </PageHeader>

        <ClientsTable clients={rows} />
      </main>
    </div>
  );
}
