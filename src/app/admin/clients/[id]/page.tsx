import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Mail, Phone, Building, Plus } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClientDetailPage({ params }: PageProps) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: projects },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">{client.name}</h1>
          {client.company && <p className="text-muted">{client.company}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> {client.email}</span>
            {client.phone && <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {client.phone}</span>}
            {client.company && <span className="flex items-center gap-2"><Building className="h-4 w-4" /> {client.company}</span>}
          </div>
          {client.notes && (
            <p className="mt-4 text-sm text-muted border-l-2 border-border pl-3">{client.notes}</p>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Projects</CardTitle>
            <Link href={`/admin/projects/new?client=${client.id}`}>
              <Button variant="accent" size="sm">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {projects && projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link key={project.id} href={`/admin/projects/${project.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-medium text-primary">{project.project_name}</p>
                        <p className="text-sm text-muted">{project.property_address}</p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-6">No projects for this client yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
