import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import {
  Inbox, FolderKanban, Pencil, CreditCard, CheckCircle, Users, Plus, Eye,
} from "lucide-react";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { PushNotificationsCard } from "@/components/admin/push-notifications-card";

export default async function AdminDashboard() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [
    { count: newRequests },
    { count: activeProjects },
    { count: editingProjects },
    { count: awaitingPayment },
    { count: readyForReview },
    { count: deliveredProjects },
    { data: recentProjects },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "new_request"),
    supabase.from("projects").select("*", { count: "exact", head: true }).not("status", "eq", "delivered").not("status", "eq", "new_request"),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "shoot_complete_editing"),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "awaiting_payment"),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "ready_for_review"),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("projects").select("*, clients(name, company)").order("created_at", { ascending: false }).limit(8),
    supabase.from("activity_logs").select("*, projects(id, project_name)").order("created_at", { ascending: false }).limit(12),
  ]);

  const stats = [
    { label: "New Requests", value: newRequests ?? 0, icon: Inbox, href: "/admin/new-requests", color: "text-blue-600 bg-blue-50" },
    { label: "Active Jobs", value: activeProjects ?? 0, icon: FolderKanban, href: "/admin/projects", color: "text-indigo-600 bg-indigo-50" },
    { label: "Shoot Complete", value: editingProjects ?? 0, icon: Pencil, href: "/admin/projects?status=shoot_complete_editing", color: "text-indigo-600 bg-indigo-50" },
    { label: "In Review", value: readyForReview ?? 0, icon: Eye, href: "/admin/projects?status=ready_for_review", color: "text-purple-600 bg-purple-50" },
    { label: "Awaiting Payment", value: awaitingPayment ?? 0, icon: CreditCard, href: "/admin/projects?status=awaiting_payment", color: "text-orange-600 bg-orange-50" },
    { label: "Delivered", value: deliveredProjects ?? 0, icon: CheckCircle, href: "/admin/projects?status=delivered", color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Command Center"
          description={`Welcome back, ${profile.full_name || profile.email}`}
        >
          <Link href="/admin/projects/new"><Button variant="accent" size="sm"><Plus className="h-4 w-4" /> New Project</Button></Link>
          <Link href="/admin/clients/new"><Button variant="outline" size="sm"><Users className="h-4 w-4" /> New Client</Button></Link>
        </PageHeader>

        <PushNotificationsCard />

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-10">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${stat.color} mb-3`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Projects</CardTitle>
                <Link href="/admin/projects" className="text-sm text-accent hover:underline">View all</Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentProjects?.map((project) => (
                  <Link key={project.id} href={`/admin/projects/${project.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium text-primary truncate">{project.project_name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {(project.clients as { name: string })?.name} · {formatDate(project.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                  </Link>
                ))}
                {(!recentProjects || recentProjects.length === 0) && (
                  <p className="text-sm text-muted text-center py-6">No projects yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <ActivityFeed logs={recentActivity ?? []} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
