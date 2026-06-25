import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { ClientsTable, type ClientRow } from "@/components/admin/clients-table";
import { normalizeStatus } from "@/lib/constants";

export default async function AdminClientsPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const service = await createServiceClient();

  const [{ data: clients }, { data: projects }, { data: activities }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, client_id, project_name, property_address, status, updated_at"),
    supabase
      .from("activity_logs")
      .select("project_id, created_at, projects(client_id)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const loginMap = new Map<string, string>();
  const userIds = (clients ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  if (userIds.length) {
    const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 });
    authData?.users?.forEach((u) => {
      if (u.last_sign_in_at) loginMap.set(u.id, u.last_sign_in_at);
    });
  }

  const projectsByClient = new Map<string, typeof projects>();
  projects?.forEach((p) => {
    if (!projectsByClient.has(p.client_id)) projectsByClient.set(p.client_id, []);
    projectsByClient.get(p.client_id)!.push(p);
  });

  const lastActivityByClient = new Map<string, string>();
  activities?.forEach((a) => {
    const clientId = (a.projects as unknown as { client_id: string } | null)?.client_id;
    if (clientId && !lastActivityByClient.has(clientId)) {
      lastActivityByClient.set(clientId, a.created_at);
    }
  });

  const rows: ClientRow[] = (clients ?? []).map((client) => {
    const clientProjects = projectsByClient.get(client.id) ?? [];
    const active = clientProjects.filter((p) => normalizeStatus(p.status) !== "delivered");
    const delivered = clientProjects.filter((p) => normalizeStatus(p.status) === "delivered");
    const latestProject = [...clientProjects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      created_at: client.created_at,
      activeProjects: active.length,
      deliveredProjects: delivered.length,
      lastActivity: lastActivityByClient.get(client.id) ?? null,
      lastLogin: client.user_id ? loginMap.get(client.user_id) ?? null : null,
      latestAddress: latestProject?.property_address ?? null,
      projectLinks: clientProjects.map((p) => ({
        id: p.id,
        name: p.project_name,
        status: normalizeStatus(p.status),
      })),
    };
  });

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
