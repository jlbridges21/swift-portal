import { Header } from "@/components/layout/header";
import { PageHeader } from "@/components/layout/header";
import { LaunchChecklistClient } from "@/components/admin/launch-checklist-client";
import { getLaunchChecklist } from "@/lib/launch-checklist";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LaunchChecklistPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const checklist = await getLaunchChecklist();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 pb-12">
        <PageHeader
          title="Launch Checklist"
          description="Verify integrations and infrastructure before your first real client. No secrets are displayed."
        />
        <LaunchChecklistClient initial={checklist} />
      </main>
    </div>
  );
}
