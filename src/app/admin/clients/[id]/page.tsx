import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-access";
import { notFound } from "next/navigation";
import { ClientCrmProfile } from "@/components/admin/clients-table";
import { ChevronLeft } from "lucide-react";
import { loadClientProfileView } from "@/lib/client-profile-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClientDetailPage({ params }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "clients" });
  const { id } = await params;

  const view = await loadClientProfileView({ businessId: tenant.businessId, profile, clientId: id });
  if (!view) notFound();

  const isStaff = profile.role === "staff";

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={isStaff ? "staff" : "admin"} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/admin/clients">
            <Button variant="ghost" size="sm" className="mb-2">
              <ChevronLeft className="h-4 w-4" />
              All Clients
            </Button>
          </Link>
        </div>
        <ClientCrmProfile
          data={view.data}
          canViewMoney={view.canViewMoney}
          w9={view.w9}
          projectCovers={view.projectCovers}
        />
      </main>
    </div>
  );
}
