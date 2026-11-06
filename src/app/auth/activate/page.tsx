import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PortalActivationPanel } from "@/components/portal/portal-activation-panel";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { getProfile } from "@/lib/auth";
import { loadActivationContext } from "@/lib/portal-activation-server";
import { maskEmail, type ThankYouMode } from "@/lib/portal-activation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activate your portal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = { searchParams: Promise<{ token?: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-12">
        <div className="w-full max-w-md space-y-5">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function InvalidLink() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <LinkIcon className="mx-auto h-10 w-10 text-muted" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-heading">This link isn&apos;t valid</h1>
      <p className="mt-2 text-sm text-muted">
        It may be incomplete or meant for a different portal. Ask the business to send you a new portal invite, or log
        in if you already have a password.
      </p>
      <Link href="/login" className="mt-5 block">
        <Button variant="accent" className="min-h-11 w-full">Go to Log In</Button>
      </Link>
    </section>
  );
}

/**
 * Activation landing for emailed / copied invite links. One step: choose a
 * password → signed in → land on the project. Expired or used links offer a
 * fresh link to the email on file.
 */
export default async function ActivatePortalPage({ searchParams }: PageProps) {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return <TenantUnavailable />;
  }
  if (!isActivePublicTenant(host)) {
    return (
      <Shell>
        <InvalidLink />
      </Shell>
    );
  }

  const { token } = await searchParams;
  const ctx = token ? await loadActivationContext(token, host.businessId) : null;
  if (!ctx || !ctx.client || (!ctx.eligibility.ok && ["wrong_business", "client_missing"].includes(ctx.eligibility.reason))) {
    return (
      <Shell>
        <InvalidLink />
      </Shell>
    );
  }

  const settings = await getAppSettings(host.businessId);
  const businessName = settings.business.businessName;
  const profile = await getProfile();
  const signedInAsClient = profile?.role === "client" && profile.client_id === ctx.client.id;

  let mode: ThankYouMode;
  if (signedInAsClient) mode = "signed_in";
  else if (ctx.portalActive) mode = "login";
  else if (ctx.eligibility.ok) mode = "create_password";
  else if (ctx.eligibility.reason === "foreign_login") mode = "none";
  else mode = "email_link";

  const expired = !ctx.eligibility.ok && ctx.eligibility.reason === "expired";
  const firstName = (ctx.client.full_name || ctx.client.name || "").trim().split(/\s+/)[0];

  return (
    <Shell>
      <div className="text-center">
        {mode === "login" || mode === "signed_in" ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        ) : null}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">
          {mode === "create_password"
            ? `Welcome${firstName ? `, ${firstName}` : ""}`
            : mode === "login" || mode === "signed_in"
              ? "Your portal is already active"
              : expired
                ? "This link has expired"
                : "This link can't be used"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "create_password"
            ? `Set a password to access your ${settings.business.portalName} account with ${businessName}.`
            : mode === "none"
              ? `Contact ${businessName} for help accessing your portal.`
              : expired
                ? "Activation links expire after 7 days for your security."
                : null}
        </p>
      </div>
      <PortalActivationPanel
        token={token!}
        mode={mode}
        maskedEmail={ctx.client.email ? maskEmail(ctx.client.email) : null}
        projectPath={ctx.payload.n}
        businessName={businessName}
        context="activate"
      />
    </Shell>
  );
}
