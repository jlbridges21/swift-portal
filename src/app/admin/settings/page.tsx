import Link from "next/link";
import { Header } from "@/components/layout/header";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { getAppSettings, NOTIFICATION_EVENT_DEFINITIONS } from "@/lib/app-settings";
import { redirect } from "next/navigation";
import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { GoogleCalendarCard } from "@/components/admin/google-calendar-card";
import { SettingsCollapsible } from "@/components/admin/settings-collapsible";
import { Suspense } from "react";

export default async function AdminSettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 pb-12">
        <PageHeader
          title="Admin Settings"
          description="Manage global notification, email, business, and proposal settings for Swift Portal."
        />
        <div className="mb-6 flex flex-wrap gap-3">
          <Link href="/admin/launch-checklist">
            <Button variant="outline" size="sm" className="min-h-11">
              Launch Checklist
            </Button>
          </Link>
        </div>
        <SettingsCollapsible
          title="Google Calendar"
          description="Connect Google Calendar to sync confirmed shoot dates."
        >
          <Suspense fallback={null}>
            <GoogleCalendarCard />
          </Suspense>
        </SettingsCollapsible>
        <AdminSettingsClient
          initialSettings={settings}
          notificationEvents={NOTIFICATION_EVENT_DEFINITIONS}
        />
      </main>
    </div>
  );
}
