import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getAppSettings } from "@/lib/app-settings";
import { getTenantContext } from "@/lib/tenant";
import { SITE } from "@/lib/site-metadata";
import { SafeHomeLink } from "@/components/auth/safe-home-link";

export const metadata: Metadata = {
  title: "Page Not Found",
};

async function safeBrandLabel(): Promise<string> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return SITE.company;
    const settings = await getAppSettings(tenant.businessId);
    return settings.business.businessName || SITE.company;
  } catch {
    return SITE.company;
  }
}

export default async function NotFound() {
  const label = await safeBrandLabel();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">{label}</p>
      <h1 className="mt-4 text-6xl font-bold tracking-tight text-primary">404</h1>
      <p className="mt-3 max-w-sm text-lg text-muted">
        This page doesn&apos;t exist, or you may not have permission to view it.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <SafeHomeLink variant="accent" />
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
