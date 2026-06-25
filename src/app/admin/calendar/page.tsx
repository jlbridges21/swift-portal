import { Header, PageHeader } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShootCalendar, type CalendarShoot } from "@/components/admin/shoot-calendar";

export default async function AdminCalendarPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createServiceClient();

  const { data: confirmed } = await supabase
    .from("shoot_proposals")
    .select("id, project_id, proposed_at, projects(project_name, property_address, clients(name))")
    .eq("status", "confirmed")
    .order("proposed_at", { ascending: true });

  const shoots: CalendarShoot[] = (confirmed ?? []).map((item) => {
    const project = item.projects as unknown as {
      project_name: string;
      property_address: string;
      clients: { name: string } | null;
    } | null;
    return {
      id: item.id,
      project_id: item.project_id,
      proposed_at: item.proposed_at,
      project_name: project?.project_name ?? "Project",
      client_name: project?.clients?.name ?? "Client",
      property_address: project?.property_address ?? "",
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Shoot Calendar"
          description="Confirmed shoots — click any event to view details or reschedule"
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
