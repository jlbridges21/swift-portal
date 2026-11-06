import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ProposalCard } from "@/components/projects/proposal-card";
import { PortalActivationPanel } from "@/components/portal/portal-activation-panel";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { loadActivationContext } from "@/lib/portal-activation-server";
import { maskEmail, resolveThankYouMode } from "@/lib/portal-activation";
import { formatDate } from "@/lib/utils";
import type { ProjectQuote } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request received",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = { searchParams: Promise<{ t?: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function ReceivedHero({ businessName, emailHint }: { businessName: string; emailHint?: string | null }) {
  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm surface-dark:border-border surface-dark:from-card surface-dark:to-card sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 surface-dark:bg-subtle">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-heading sm:text-3xl">
        Your request has been received
      </h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Thank you! {businessName} will review the details and follow up shortly.{" "}
        <span className="font-medium text-heading">You don&apos;t need to do anything else.</span>
      </p>
      {emailHint ? (
        <p className="mt-3 text-xs text-muted">A confirmation is on its way to {emailHint}.</p>
      ) : null}
    </section>
  );
}

export default async function RequestThankYouPage({ searchParams }: PageProps) {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return <TenantUnavailable />;
  }
  if (!isActivePublicTenant(host)) {
    return (
      <Shell>
        <ReceivedHero businessName="The team" />
      </Shell>
    );
  }

  const settings = await getAppSettings(host.businessId);
  const businessName = settings.business.businessName;
  const { t } = await searchParams;
  const ctx = t ? await loadActivationContext(t, host.businessId) : null;

  // Unknown, foreign or long-expired link: confirm generically, reveal nothing.
  if (
    !ctx ||
    ctx.payload.k !== "request" ||
    !ctx.client ||
    ctx.expired ||
    (!ctx.eligibility.ok && ctx.eligibility.reason === "wrong_business")
  ) {
    return (
      <Shell>
        <ReceivedHero businessName={businessName} />
        <div className="text-center">
          <Link href="/request">
            <Button variant="outline" className="min-h-11">Submit another request</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  const db = await createTenantServiceClient(host.businessId);
  const projectId = ctx.payload.p;
  const { data: project } = projectId
    ? await db
        .from("projects")
        .select("id, project_name, property_address, service_type, shoot_date, client_id")
        .eq("id", projectId)
        .maybeSingle()
    : { data: null };

  const { data: quoteRow } = project
    ? await db
        .from("project_quotes")
        .select(
          "id, project_id, title, description, line_items, total_cents, notes, expires_at, status, quote_kind, sent_at, approved_at, changes_feedback, created_by, created_at, updated_at"
        )
        .eq("project_id", project.id)
        .eq("quote_kind", "preliminary")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const quote = (quoteRow as ProjectQuote | null) ?? null;

  const profile = await getProfile();
  const signedInAsClient = profile?.role === "client" && profile.client_id === ctx.client.id;
  const mode = resolveThankYouMode({
    eligibility: ctx.eligibility,
    portalActive: ctx.portalActive,
    signedInAsClient,
    hasEmail: Boolean(ctx.client.email),
  });
  const instantPreliminary = settings.proposals.autoPreliminaryEstimate !== false;
  const projectPath = project ? `/dashboard/projects/${project.id}` : "/dashboard";

  return (
    <Shell>
      <ReceivedHero businessName={businessName} emailHint={ctx.client.email ? maskEmail(ctx.client.email) : null} />

      {project ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your request</h2>
          <p className="mt-2 text-lg font-semibold text-heading">{project.project_name}</p>
          <div className="mt-3 space-y-2 text-sm">
            {project.property_address ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <p className="text-foreground">{project.property_address}</p>
              </div>
            ) : null}
            {project.service_type ? (
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <p className="text-foreground">{project.service_type}</p>
              </div>
            ) : null}
            {project.shoot_date ? (
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <p className="text-foreground">Preferred date: {formatDate(project.shoot_date)}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {instantPreliminary ? (
        quote ? (
          <section aria-labelledby="estimate-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 id="estimate-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
                Preliminary estimate
              </h2>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 surface-dark:bg-subtle surface-dark:text-foreground">
                Preliminary
              </span>
            </div>
            <ProposalCard quote={quote} kind="preliminary" />
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5 text-sm shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pricing</h2>
            <p className="mt-2 text-base font-semibold text-heading">Custom quote</p>
            <p className="mt-1 text-muted">
              This project needs a custom quote. {businessName} will review your request and send pricing shortly.
            </p>
          </section>
        )
      ) : null}

      <PortalActivationPanel
        token={t!}
        mode={mode}
        maskedEmail={ctx.client.email ? maskEmail(ctx.client.email) : null}
        projectPath={projectPath}
        businessName={businessName}
      />

      <p className="px-2 text-center text-xs text-muted">
        Your request is saved. It&apos;s safe to close this page.
      </p>
    </Shell>
  );
}
