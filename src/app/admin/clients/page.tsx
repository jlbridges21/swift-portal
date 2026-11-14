import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-access";
import { Plus } from "lucide-react";
import { ClientsTable } from "@/components/admin/clients-table";
import { countClients, getClientListRows, getClientWorkspaceRows } from "@/lib/clients-crm";
import { isOwnerAdmin, staffCan, visibleClientIdsFor } from "@/lib/staff-access";
import { getUiExperience } from "@/lib/ui-rollout-server";
import { ClientsWorkspace } from "@/components/admin/clients-workspace/clients-workspace";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "clients" });
  const businessId = tenant.businessId;
  const { view } = await searchParams;
  const showDeleted = view === "deleted";
  const clientIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleClientIdsFor(businessId, profile);

  if ((await getUiExperience(profile)).mode === "new") {
    const owner = isOwnerAdmin(profile);
    const canViewMoney = staffCan(profile, "money.view");
    const [rows, otherCount] = await Promise.all([
      getClientWorkspaceRows(businessId, { includeDeleted: showDeleted, clientIds, canViewMoney }),
      countClients(businessId, { deleted: !showDeleted, clientIds }),
    ]);
    return (
      <div className="min-h-screen bg-background">
        <main className="app-page app-page-wide mx-auto max-w-[100vw] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <PageHeader
            title={showDeleted ? "Hidden Clients" : "Clients"}
            description={
              showDeleted
                ? `${rows.length} hidden client${rows.length === 1 ? "" : "s"}`
                : "Manage your clients and their portal access in one place."
            }
          />
          <ClientsWorkspace
            clients={rows}
            showDeleted={showDeleted}
            hiddenCount={showDeleted ? rows.length : otherCount}
            activeCount={showDeleted ? otherCount : rows.length}
            permissions={{
              canCreate: staffCan(profile, "clients.create"),
              canEdit: staffCan(profile, "clients.edit"),
              canDelete: staffCan(profile, "clients.delete"),
              canAddToProjects: staffCan(profile, "clients.add_to_projects"),
              canCreateProject: staffCan(profile, "projects.create"),
              // Portal invite / recovery routes are owner/admin only (requireAdminApi adminOnly).
              canManagePortal: owner,
              canMessage: staffCan(profile, "area.messages"),
              canSendMessages: staffCan(profile, "messages.send"),
              canViewMoney,
            }}
          />
        </main>
      </div>
    );
  }

  const rows = await getClientListRows(businessId, {
    includeDeleted: showDeleted,
    clientIds,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="app-page app-page-table mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
