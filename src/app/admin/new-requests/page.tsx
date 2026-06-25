import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { NewRequestsList } from "@/components/admin/new-requests-list";

export default async function AdminNewRequestsPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, clients(name, company, email)")
    .eq("status", "new_request")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="New Requests"
          description={`${projects?.length ?? 0} project${(projects?.length ?? 0) !== 1 ? "s" : ""} awaiting review`}
        >
          <Link href="/admin/projects">
            <Button variant="outline" size="sm">
              <FolderKanban className="h-4 w-4" />
              Full Pipeline
            </Button>
          </Link>
        </PageHeader>

        <NewRequestsList projects={projects ?? []} />
      </main>
    </div>
  );
}
