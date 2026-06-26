import { Header } from "@/components/layout/header";
import { getProfile } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AdminProjectDetail } from "@/components/admin/project-detail";
import { filterCommunicationActivities, type ProjectNotificationRow } from "@/lib/communications";
import { buildEmailCommunicationSummaries, getProjectEmailEvents } from "@/lib/email-analytics";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectPage({ params }: PageProps) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  const [
    { data: project },
    { data: media },
    { data: tours },
    { data: payments },
    { data: shootProposals },
    { data: projectClients },
    { data: allClients },
    { data: activities },
    { data: revisions },
    { data: quotes },
    { data: assetReviews },
  ] = await Promise.all([
    supabase.from("projects").select("*, clients(*)").eq("id", id).single(),
    supabase.from("media_assets").select("*").eq("project_id", id).order("display_order"),
    supabase.from("tours").select("*").eq("project_id", id).order("display_order"),
    supabase.from("payments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("shoot_proposals").select("*").eq("project_id", id).order("proposed_at", { ascending: true }),
    supabase.from("project_clients").select("*, clients(id, name, email, company)").eq("project_id", id),
    supabase.from("clients").select("id, name, email, company").order("name"),
    supabase.from("activity_logs").select("*").eq("project_id", id).order("created_at", { ascending: true }),
    supabase.from("revisions").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_quotes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("asset_reviews").select("*").eq("project_id", id),
  ]);

  if (!project) notFound();

  const [emailEvents, { data: projectNotifications }] = await Promise.all([
    getProjectEmailEvents(id),
    service
      .from("notifications")
      .select("id, type, title, body, link, created_at, user_id, profiles(email, full_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const communicationEmails = buildEmailCommunicationSummaries(emailEvents);
  const communicationNotifications: ProjectNotificationRow[] = (projectNotifications ?? []).map(
    (row) => {
      const profile = row.profiles as { email?: string; full_name?: string } | null;
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        created_at: row.created_at,
        user_id: row.user_id,
        recipient_email: profile?.email ?? null,
        recipient_name: profile?.full_name ?? null,
      };
    }
  );
  const communicationActivities = filterCommunicationActivities(activities ?? []);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalUrl = `${appUrl}/dashboard/projects/${id}?preview=1`;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
        <AdminProjectDetail
          project={project}
          media={media ?? []}
          tours={tours ?? []}
          payments={payments ?? []}
          shootProposals={shootProposals ?? []}
          projectClients={projectClients ?? []}
          allClients={allClients ?? []}
          activities={activities ?? []}
          revisions={revisions ?? []}
          quotes={quotes ?? []}
          assetReviews={assetReviews ?? []}
          portalUrl={portalUrl}
          communicationEmails={communicationEmails}
          communicationNotifications={communicationNotifications}
          communicationActivities={communicationActivities}
        />
      </main>
    </div>
  );
}
