import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getProfile } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { createClient } from "@/lib/supabase/server";
import { getProjectHeroPosterUrl } from "@/lib/cover";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { UrlToastHandler } from "@/components/ui/url-toast-handler";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { filterClientVisibleActivities } from "@/lib/communications";
import { getClientNextStep } from "@/lib/journey";
import { normalizeStatus } from "@/lib/constants";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowRight, Calendar, CreditCard, MapPin, Sparkles, FileText, CheckCircle2,
} from "lucide-react";
import { formatShootDateTime, getProjectShootDateTime } from "@/lib/scheduling";
import { getProjectActiveQuote, getQuotePriceDisplay } from "@/lib/quote-display";
import { paymentCheckoutPath } from "@/lib/payment-status";
import type { Project, ShootProposal, ActivityLog, ProjectQuote } from "@/lib/types";

export default async function ClientDashboard() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");

  const supabase = await createClient();
  const appSettings = await getAppSettings();
  const brand = getPortalBrandFromSettings(appSettings);
  const firstName = profile.full_name?.split(" ")[0] || "there";

  const [{ data: projects }, { data: payments }, { data: activities }, { data: shootProposals }, { data: allQuotes }] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("payments").select("*, projects(project_name)").order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("*, projects(id, project_name)")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("shoot_proposals").select("*").in("status", ["confirmed", "pending"]),
    supabase.from("project_quotes").select("*").in("status", ["sent", "approved"]).order("updated_at", { ascending: false }),
  ]);

  const proposalsByProject = new Map<string, ShootProposal[]>();
  shootProposals?.forEach((p) => {
    if (!proposalsByProject.has(p.project_id)) proposalsByProject.set(p.project_id, []);
    proposalsByProject.get(p.project_id)!.push(p);
  });

  const activeProjects = (projects ?? []).filter((p) => normalizeStatus(p.status) !== "delivered");
  const deliveredProjects = (projects ?? []).filter((p) => normalizeStatus(p.status) === "delivered");
  const outstandingInvoices = (payments ?? []).filter((p) => p.status === "pending" || p.status === "sent");

  const quotesByProject = new Map<string, ProjectQuote[]>();
  (allQuotes ?? []).forEach((q) => {
    if (!quotesByProject.has(q.project_id)) quotesByProject.set(q.project_id, []);
    quotesByProject.get(q.project_id)!.push(q as ProjectQuote);
  });

  const pendingEstimates = activeProjects
    .map((p) => {
      const active = getProjectActiveQuote(quotesByProject.get(p.id) ?? [], "client");
      if (!active || active.quote.status !== "sent") return null;
      return { project: p, quote: active.quote };
    })
    .filter(Boolean) as { project: Project; quote: ProjectQuote }[];

  const featured = activeProjects[0] as Project | undefined;
  const otherActive = activeProjects.slice(1);

  const coverUrls = await Promise.all(
    [...activeProjects, ...deliveredProjects].map((p) => getProjectHeroPosterUrl(supabase, p))
  );
  const coverMap = new Map(
    [...activeProjects, ...deliveredProjects].map((p, i) => [p.id, coverUrls[i]])
  );

  let featuredCover = featured ? coverMap.get(featured.id) ?? null : null;
  let featuredPayment = featured ? outstandingInvoices.find((p) => p.project_id === featured.id) : undefined;
  let featuredStep = featured
    ? getClientNextStep(featured, !!featuredPayment, proposalsByProject.get(featured.id) ?? [])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Suspense>
        <UrlToastHandler />
      </Suspense>
      <Header
        variant="dashboard"
        userRole="client"
        userName={profile.full_name}
        userAvatar={profile.avatar_url}
      />

      <main className="mobile-container py-10">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent uppercase tracking-wider">{brand.name}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 text-lg text-muted">
              You have {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <div className="hidden sm:flex sm:items-center">
            <Avatar name={profile.full_name || profile.email} src={profile.avatar_url} size="lg" />
          </div>
        </div>

        {featured && featuredStep && (
          <section className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Next Action
            </p>
            <Link href={`/dashboard/projects/${featured.id}${featuredStep.actionHref?.startsWith("#") ? featuredStep.actionHref : ""}`}>
              <Card className="overflow-hidden border-0 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5">
                <div className="grid md:grid-cols-5">
                  <div className="relative aspect-[16/10] md:aspect-auto md:col-span-2 bg-primary min-h-[200px]">
                    {featuredCover ? (
                      <Image src={featuredCover} alt="" fill className="object-cover" sizes="40vw" priority />
                    ) : (
                      <CoverPlaceholder />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent md:bg-gradient-to-r" />
                    <div className="absolute top-4 left-4">
                      <StatusBadge status={featured.status} audience="client" />
                    </div>
                  </div>
                  <CardContent className="md:col-span-3 p-6 sm:p-8 flex flex-col justify-center">
                    <h2 className="text-2xl font-bold text-primary">{featured.project_name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin className="h-4 w-4 shrink-0" /> {featured.property_address}
                    </p>
                    {featured && normalizeStatus(featured.status) === "scheduled" && (() => {
                      const shootWhen = getProjectShootDateTime(featured, proposalsByProject.get(featured.id) ?? []);
                      return shootWhen ? (
                      <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-700">
                        <Calendar className="h-4 w-4" />
                        Shoot: {formatShootDateTime(shootWhen, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                      ) : null;
                    })()}
                    {featuredPayment && (
                      <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-orange-700">
                        <CreditCard className="h-4 w-4" />
                        Invoice due: {formatCurrency(featuredPayment.amount)}
                      </p>
                    )}
                    <div className="mt-4 rounded-lg bg-slate-50 border border-border p-4">
                      <p className="font-medium text-sm text-primary">{featuredStep.title}</p>
                      <p className="text-sm text-muted mt-1">{featuredStep.description}</p>
                    </div>
                    <Button variant="accent" className="mt-6 w-fit">
                      {featuredStep.actionLabel || "View Project"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </div>
              </Card>
            </Link>
          </section>
        )}

        {!featured && (
          <Card className="mb-10 border-dashed shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-lg font-medium text-primary">No active projects yet</p>
              <p className="text-muted mt-2">Request a shoot to get started with {brand.name}.</p>
              <Link href="/dashboard/request">
                <Button variant="accent" className="mt-6">Request a Shoot</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {otherActive.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-primary mb-4">All Active Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherActive.map((project) => {
                const cover = coverMap.get(project.id);
                const step = getClientNextStep(project, outstandingInvoices.some((p) => p.project_id === project.id), proposalsByProject.get(project.id) ?? []);
                return (
                  <Link key={`active-${project.id}`} href={`/dashboard/projects/${project.id}`}>
                    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full">
                      <div className="relative aspect-video bg-slate-100">
                        {cover ? (
                          <Image src={cover} alt="" fill className="object-cover" sizes="33vw" />
                        ) : (
                          <CoverPlaceholder />
                        )}
                        <div className="absolute top-2 left-2">
                          <StatusBadge status={project.status} audience="client" />
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <p className="font-medium text-sm text-primary">{project.project_name}</p>
                        <p className="text-xs text-muted mt-1 line-clamp-1">{project.property_address}</p>
                        {step && (
                          <p className="text-xs text-accent mt-2 line-clamp-2">{step.title}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {activeProjects.length > 1 && otherActive.length === 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-primary mb-4">All Active Projects</h2>
            <p className="text-sm text-muted">Your featured project above is your only active project.</p>
          </section>
        )}

        <div className="grid gap-10 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-10">
            {pendingEstimates.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Estimates Awaiting Approval
                </h2>
                <div className="space-y-3">
                  {pendingEstimates.map(({ project, quote }) => {
                    const price = getQuotePriceDisplay(quote);
                    return (
                      <Link key={`estimate-${quote.id}`} href={`/dashboard/projects/${project.id}#quote`}>
                        <Card className="border-amber-200/80 shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-primary">{project.project_name}</p>
                              <p className="text-sm text-muted mt-0.5">{quote.title}</p>
                              {price.showPrice && (
                                <p className="text-lg font-bold text-primary mt-1">{formatCurrency(price.priceCents)}</p>
                              )}
                            </div>
                            <Button variant="accent" size="sm" className="min-h-11 shrink-0 w-full sm:w-auto">
                              Review Estimate <ArrowRight className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Recent Activity</h2>
              <Card className="shadow-sm border-0 ring-1 ring-black/5">
                <CardContent className="p-6">
                  <ActivityFeed
                    logs={filterClientVisibleActivities((activities ?? []) as (ActivityLog & { projects?: { id: string; project_name: string } | null })[])}
                    projectLinkPrefix="/dashboard/projects"
                    clientMode
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="space-y-8">
            {outstandingInvoices.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  Outstanding Payments
                </h2>
                <div className="space-y-3">
                  {outstandingInvoices.map((payment) => (
                    <Card key={`payment-${payment.id}`} className="border-orange-200/80 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xl font-bold text-primary">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted mt-1">{payment.description}</p>
                        {(payment.projects as { project_name: string })?.project_name && (
                          <p className="text-xs text-muted mt-1">
                            {(payment.projects as { project_name: string }).project_name}
                          </p>
                        )}
                        <a href={paymentCheckoutPath(payment.id)} className="mt-3 block">
                          <Button variant="accent" size="sm" className="w-full min-h-11">Pay Now</Button>
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {outstandingInvoices.length === 0 && payments?.some((p) => p.status === "paid") && (
              <section>
                <Card className="border-emerald-200/80 bg-emerald-50/50 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-900">All caught up</p>
                      <p className="text-sm text-emerald-700/80">No outstanding payments</p>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

          </div>
        </div>

        {deliveredProjects.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-primary mb-4">Delivered Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deliveredProjects.map((project) => (
                <Link key={`delivered-${project.id}`} href={`/dashboard/projects/${project.id}`}>
                  <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full">
                    <div className="relative aspect-video bg-slate-100">
                      {coverMap.get(project.id) ? (
                        <Image src={coverMap.get(project.id)!} alt="" fill className="object-cover" sizes="33vw" />
                      ) : (
                        <CoverPlaceholder />
                      )}
                    </div>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm text-primary">{project.project_name}</p>
                      <p className="text-xs text-muted mt-1 line-clamp-1">{project.property_address}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
