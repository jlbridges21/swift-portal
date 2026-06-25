import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectPipeline } from "@/components/admin/project-pipeline";
import { normalizeStatus } from "@/lib/constants";

export default async function AdminProjectsPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: projects }, { data: payments }, { data: activities }, { data: confirmedShoots }] = await Promise.all([
    supabase.from("projects").select("*, clients(name, company)").order("updated_at", { ascending: false }),
    supabase.from("payments").select("project_id, status").eq("status", "pending"),
    supabase.from("activity_logs").select("project_id, description, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("shoot_proposals").select("project_id, proposed_at").eq("status", "confirmed"),
  ]);

  const confirmedShootMap = new Map(confirmedShoots?.map((s) => [s.project_id, s.proposed_at]));

  const pendingSet = new Set(payments?.map((p) => p.project_id));
  const latestActivity = new Map<string, string>();
  activities?.forEach((a) => {
    if (a.project_id && !latestActivity.has(a.project_id)) {
      latestActivity.set(a.project_id, a.description);
    }
  });

  const enriched = (projects ?? []).map((p) => ({
    ...p,
    status: normalizeStatus(p.status),
    pendingPayment: pendingSet.has(p.id),
    recentActivity: latestActivity.get(p.id),
    confirmedShootAt: confirmedShootMap.get(p.id) ?? null,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-[100vw] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Project Pipeline"
          description="Drag projects between stages — Swift Aerial Media workflow board."
        >
          <Link href="/admin/projects/new">
            <Button variant="accent" size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </PageHeader>

        <ProjectPipeline projects={enriched} />
      </main>
    </div>
  );
}
