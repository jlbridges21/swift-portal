import { Header, PageHeader } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-access";
import { getProjectHeroPosterUrl } from "@/lib/cover";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { ShootCalendar, type CalendarShoot } from "@/components/admin/shoot-calendar";

export default async function AdminCalendarPage() {
  const { tenant } = await requireAdminPage();
  const db = await createTenantServiceClient(tenant.businessId);

  const { data: confirmed } = await db
    .from("shoot_proposals")
    .select(
      "id, project_id, proposed_at, projects(project_name, property_address, service_type, status, cover_image_id, cover_image_url, clients(name))"
    )
    .eq("status", "confirmed")
    .order("proposed_at", { ascending: true });

  const shoots: CalendarShoot[] = await Promise.all(
    (confirmed ?? []).map(async (item) => {
      const project = item.projects as unknown as {
        project_name: string;
        property_address: string;
        service_type: string;
        status: string;
        cover_image_id: string | null;
        cover_image_url: string | null;
        clients: { name: string } | null;
      } | null;

      const cover_url = project
        ? await getProjectHeroPosterUrl(
            db.raw,
            {
              id: item.project_id,
              cover_image_id: project.cover_image_id,
              cover_image_url: project.cover_image_url,
            },
            tenant.businessId
          )
        : null;

      return {
        id: item.id,
        project_id: item.project_id,
        proposed_at: item.proposed_at,
        project_name: project?.project_name ?? "Project",
        client_name: project?.clients?.name ?? "Client",
        property_address: project?.property_address ?? "",
        service_type: project?.service_type ?? "",
        status: project?.status ?? "scheduled",
        cover_url,
      };
    })
  );

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          title="Shoot Calendar"
          description="Month, week, and agenda views — drag to reschedule on desktop, tap to edit"
        />

        {shoots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted">
              No confirmed shoots yet. Propose dates on a project and have clients confirm.
            </CardContent>
          </Card>
        ) : (
          <ShootCalendar shoots={shoots} />
        )}
      </main>
    </div>
  );
}
