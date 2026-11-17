import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PortalActivationPanel } from "@/components/portal/portal-activation-panel";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { RequestSummaryCard } from "@/components/booking/request-summary-card";
import { NextStepChoices } from "@/components/booking/next-step-choices";
import { PersonAvatar } from "@/components/admin/booking/booking-ui";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { getProfile } from "@/lib/auth";
import { loadActivationContext } from "@/lib/portal-activation-server";
import { maskEmail, resolveThankYouMode } from "@/lib/portal-activation";
import { openBookingToken, sealBookingToken, bookingPagePath, shootPagePath } from "@/lib/booking/token";
import { loadClientBookingView } from "@/lib/booking/client-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request received",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = { searchParams: Promise<{ t?: string; b?: string }> };

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className={wide ? "mx-auto max-w-6xl space-y-5 sm:space-y-6" : "mx-auto max-w-2xl space-y-5 sm:space-y-6"}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function ReceivedHero({ businessName, emailHint, estimate }: { businessName: string; emailHint?: string | null; estimate?: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-card to-accent-subtle p-6 shadow-sm surface-dark:border-border surface-dark:from-card surface-dark:to-card sm:p-8">
      <div className="flex items-start gap-4 sm:items-center sm:gap-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 surface-dark:bg-subtle sm:h-16 sm:w-16">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 sm:h-9 sm:w-9" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">Your request was received!</h1>
          <p className="mt-1.5 text-muted">
            Thanks for your request!{" "}
            {estimate ? "We've prepared an instant preliminary estimate below." : `${businessName} will review the details and follow up shortly.`}
          </p>
          {emailHint ? <p className="mt-2 text-xs text-muted">A confirmation is on its way to {emailHint}.</p> : null}
        </div>
        <CalendarCheck2 className="ml-auto hidden h-20 w-20 shrink-0 text-accent/30 md:block" aria-hidden />
      </div>
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
  const { t, b } = await searchParams;
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

  const projectId = ctx.payload.p;
  // The booking token must belong to this same request; otherwise mint one for it.
  const opened = openBookingToken(b);
  const bookingToken =
    projectId && opened && opened.p === projectId && opened.c === ctx.client.id && opened.b === host.businessId
      ? b!
      : projectId
        ? sealBookingToken({ businessId: host.businessId, clientId: ctx.client.id, projectId })
        : null;
  const loaded = projectId ? await loadClientBookingView(host.businessId, projectId) : null;
  const view = loaded?.view ?? null;

  const profile = await getProfile();
  const signedInAsClient = profile?.role === "client" && profile.client_id === ctx.client.id;
  const mode = resolveThankYouMode({
    eligibility: ctx.eligibility,
    portalActive: ctx.portalActive,
    signedInAsClient,
    hasEmail: Boolean(ctx.client.email),
  });
  const projectPath = projectId ? `/dashboard/projects/${projectId}` : "/dashboard";
  const scheduleHref = bookingToken ? bookingPagePath(bookingToken) : "/request";
  const shootHref = bookingToken ? shootPagePath(bookingToken) : "/request";
  const alreadyScheduled = view?.appointment?.status === "confirmed";

  return (
    <Shell wide>
      <ReceivedHero
        businessName={businessName}
        emailHint={ctx.client.email ? maskEmail(ctx.client.email) : null}
        estimate={Boolean(view?.estimate)}
      />

      {view ? <RequestSummaryCard view={view} /> : null}

      {view && alreadyScheduled ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-heading">Your shoot is already scheduled.</p>
          <Link href={shootHref}>
            <Button variant="accent">View shoot details</Button>
          </Link>
        </section>
      ) : view && view.bookable && bookingToken ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
              <CalendarCheck2 className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">What&apos;s next? Schedule your shoot</h2>
              <p className="mt-1 text-muted">
                {view.mode === "optional"
                  ? "You can book a time now, or request without scheduling and we'll follow up to find a time that works for you."
                  : "Choose a time for your shoot to finish your request."}
              </p>
            </div>
          </div>
          <NextStepChoices
            scheduleHref={scheduleHref}
            auth={{ b: bookingToken }}
            allowSkip={view.mode === "optional"}
            requestedHref={`${shootHref}&requested=1`}
          />
          {view.team && view.staffPreview.length ? (
            <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-subtle/50 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="flex items-center gap-2 font-semibold text-heading">
                  <Users className="h-5 w-5 text-accent" aria-hidden /> Our photographers
                </p>
                <p className="text-sm text-muted">
                  {view.clientChoosesStaff
                    ? "Choose your favorite when you pick a time, or let us assign the best available photographer."
                    : "We'll assign the best available photographer for your time and location."}
                </p>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {view.staffPreview.map((s) => (
                    <li key={s.userId} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                      <PersonAvatar name={s.name} url={s.avatarUrl} size={40} />
                      <span>
                        <span className="block text-sm font-semibold text-heading">{s.name}</span>
                        <span className="block text-xs text-muted">{s.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="max-w-xs text-xs text-muted md:border-l md:border-border md:pl-4">
                Available times are based on our studio calendar and include any travel time to your property.
              </p>
            </div>
          ) : null}
        </section>
      ) : view && view.mode !== "off" && view.notBookableReason ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm shadow-sm">
          <p className="font-semibold text-heading">Scheduling</p>
          <p className="mt-1 text-muted">{view.notBookableReason}</p>
        </section>
      ) : null}

      <PortalActivationPanel
        token={t!}
        mode={mode}
        maskedEmail={ctx.client.email ? maskEmail(ctx.client.email) : null}
        projectPath={projectPath}
        businessName={businessName}
      />

      <p className="flex items-center justify-center gap-1.5 px-2 text-center text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Your request is saved. It&apos;s safe to close this page.
      </p>
    </Shell>
  );
}
