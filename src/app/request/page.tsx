import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PublicRequestForm } from "@/components/forms/public-request-form";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const host = await getPublicHostContext();

  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return <TenantUnavailable />;
  }

  if (!isActivePublicTenant(host)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-heading">Request a shoot from a business portal</h1>
          <p className="mt-3 max-w-md text-muted">
            ShootPortal itself does not take project requests. Open your provider&apos;s portal
            (their custom domain or <code className="text-sm">{`{slug}.shootportal.app`}</code>) to
            submit a request.
          </p>
          <Link href="/login" className="mt-8">
            <Button variant="accent">Sign In</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const settings = await getAppSettings(host.businessId!);
  // Scenario D: a signed-in client of this business skips contact + account steps.
  const profile = await getProfile();
  let signedInClient: { name: string; email: string } | null = null;
  if (profile?.role === "client" && profile.client_id && (!profile.business_id || profile.business_id === host.businessId)) {
    const db = await createTenantServiceClient(host.businessId!);
    const { data: client } = await db
      .from("clients")
      .select("id, name, full_name, email, deleted_at")
      .eq("id", profile.client_id)
      .maybeSingle();
    if (client && !client.deleted_at) {
      signedInClient = {
        name: client.full_name || client.name || profile.full_name || "",
        email: client.email || profile.email || "",
      };
    }
  }
  return (
    <PublicRequestForm
      instantPreliminaryEstimate={settings.proposals.autoPreliminaryEstimate !== false}
      signedInClient={signedInClient}
    />
  );
}
