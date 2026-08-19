import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PublicRequestForm } from "@/components/forms/public-request-form";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";

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
          <h1 className="text-2xl font-bold text-primary">Request a shoot from a business portal</h1>
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

  return <PublicRequestForm />;
}
