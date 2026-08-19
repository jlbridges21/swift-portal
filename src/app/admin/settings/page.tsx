import { Suspense } from "react";
import { Header, PageHeader } from "@/components/layout/header";
import { getProfile } from "@/lib/auth";
import { getAppSettings, NOTIFICATION_EVENT_DEFINITIONS } from "@/lib/app-settings";
import { requireTenantContext } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { GoogleCalendarCard } from "@/components/admin/google-calendar-card";
import { StripeConnectCard } from "@/components/admin/stripe-connect-card";
import { SetupChecklistCard } from "@/components/admin/setup-checklist-card";
import { ServicesSettingsCard } from "@/components/admin/services-settings-card";
import { SettingsCollapsible } from "@/components/admin/settings-collapsible";

export default async function AdminSettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/dashboard");

  const tenant = await requireTenantContext();
  const settings = await getAppSettings(tenant.businessId);

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 pb-12">
        <PageHeader
          title="Admin Settings"
          description={`Manage global notification, email, business, and proposal settings for ${settings.business.portalName}.`}
        />
        <SetupChecklistCard settings={settings} />
        <SettingsCollapsible
          id="settings-payments"
          title="Payments"
          description="Connect your Stripe account so clients pay you directly."
        >
          <Suspense fallback={null}>
            <StripeConnectCard />
          </Suspense>
        </SettingsCollapsible>
        <SettingsCollapsible
          title="Google Calendar"
          description="Connect Google Calendar to sync confirmed shoot dates."
        >
          <Suspense fallback={null}>
            <GoogleCalendarCard />
          </Suspense>
        </SettingsCollapsible>
        <SettingsCollapsible
          id="settings-services"
          title="Services"
          description="Catalog and preliminary estimate prices for this business."
        >
          <ServicesSettingsCard />
        </SettingsCollapsible>
        <AdminSettingsClient
          initialSettings={settings}
          notificationEvents={NOTIFICATION_EVENT_DEFINITIONS}
        />
      </main>
    </div>
  );
}
