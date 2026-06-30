import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { PushNotificationsCard } from "@/components/admin/push-notifications-card";
import { AdminOpsDashboard } from "@/components/admin/admin-ops-dashboard";
import { fetchAdminDashboardData } from "@/lib/admin-dashboard";

export default async function AdminDashboard() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: recentProjects }, { data: recentActivity }, dashboardData] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name, company, deleted_at)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("activity_logs").select("*, projects(id, project_name)").order("created_at", { ascending: false }).limit(12),
    fetchAdminDashboardData(),
  ]);

  return (
    <div className="min-h-screen w-full bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Command Center"
          description={`What needs your attention today, ${profile.full_name?.split(" ")[0] || "there"}?`}
          className="min-w-0"
        >
          <Link href="/admin/projects/new">
            <Button variant="accent" size="sm" className="min-h-11">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
        </PageHeader>

        <PushNotificationsCard />

        <AdminOpsDashboard data={dashboardData} />

        <div className="mt-10 grid w-full max-w-full min-w-0 gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2">
                <CardTitle className="min-w-0">Recent Projects</CardTitle>
                <Link href="/admin/projects" className="shrink-0 text-sm text-accent hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3">
                {(() => {
                  const visibleRecent = (recentProjects ?? []).filter(
                    (project) =>
                      !project.deleted_at &&
                      !(project.clients as { deleted_at?: string | null } | null)?.deleted_at
                  );
                  if (!visibleRecent.length) {
                    return <p className="py-6 text-center text-sm text-muted">No projects yet</p>;
                  }
                  return visibleRecent.map((project) => (
                    <Link key={project.id} href={`/admin/projects/${project.id}`} className="block min-w-0">
                      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium text-primary break-words whitespace-normal">{project.project_name}</p>
                          <p className="mt-0.5 text-xs text-muted break-words whitespace-normal">
                            {(project.clients as { name: string })?.name} · {formatDate(project.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={project.status} className="max-w-full shrink-0 self-start whitespace-normal sm:text-right" />
                      </div>
                    </Link>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>

          <Card className="w-full max-w-full min-w-0 overflow-hidden">
            <CardHeader className="min-w-0">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ActivityFeed logs={recentActivity ?? []} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
