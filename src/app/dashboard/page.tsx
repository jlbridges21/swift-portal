import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProjectHeroPosterUrl } from "@/lib/cover";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { UrlToastHandler } from "@/components/ui/url-toast-handler";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { getClientNextStep } from "@/lib/journey";
import { normalizeStatus } from "@/lib/constants";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowRight, Calendar, CreditCard, MapPin, Plus, Sparkles,
} from "lucide-react";
import { formatShootDateTime, getProjectShootDateTime } from "@/lib/scheduling";
import type { Project, ShootProposal, ActivityLog } from "@/lib/types";

export default async function ClientDashboard() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");

  const supabase = await createClient();
  const firstName = profile.full_name?.split(" ")[0] || "there";

  const [{ data: projects }, { data: payments }, { data: activities }, { data: shootProposals }] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("payments").select("*, projects(project_name)").order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("*, projects(id, project_name)")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("shoot_proposals").select("*").eq("status", "confirmed"),
  ]);

  const proposalsByProject = new Map<string, ShootProposal[]>();
  shootProposals?.forEach((p) => {
    if (!proposalsByProject.has(p.project_id)) proposalsByProject.set(p.project_id, []);
    proposalsByProject.get(p.project_id)!.push(p);
  });

  const activeProjects = (projects ?? []).filter((p) => normalizeStatus(p.status) !== "delivered");
  const deliveredProjects = (projects ?? []).filter((p) => normalizeStatus(p.status) === "delivered");
  const outstandingInvoices = (payments ?? []).filter((p) => p.status === "pending");

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

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-accent uppercase tracking-wider">Swift Aerial Media</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 text-lg text-muted">
              You have {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <Avatar name={profile.full_name || profile.email} src={profile.avatar_url} size="lg" className="hidden sm:flex" />
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
                      <StatusBadge status={featured.status} />
                    </div>
                  </div>
                  <CardContent className="md:col-span-3 p-8 flex flex-col justify-center">
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
              <p className="text-muted mt-2">Request a shoot to get started with Swift Aerial Media.</p>
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
                          <StatusBadge status={project.status} />
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
          <section className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-primary mb-4">Recent Activity</h2>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <ActivityFeed
                  logs={(activities ?? []) as (ActivityLog & { projects?: { id: string; project_name: string } | null })[]}
                  projectLinkPrefix="/dashboard/projects"
                />
              </CardContent>
            </Card>
          </section>

          <div className="space-y-8">
            {outstandingInvoices.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-primary mb-4">Outstanding Payments</h2>
                <div className="space-y-3">
                  {outstandingInvoices.map((payment) => (
                    <Card key={`payment-${payment.id}`} className="border-orange-200 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xl font-bold text-primary">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted mt-1">{payment.description}</p>
                        {(payment.projects as { project_name: string })?.project_name && (
                          <p className="text-xs text-muted mt-1">
                            {(payment.projects as { project_name: string }).project_name}
                          </p>
                        )}
                        {payment.stripe_payment_link_url && (
                          <a href={payment.stripe_payment_link_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                            <Button variant="accent" size="sm" className="w-full">Pay Now</Button>
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <Link href="/dashboard/request">
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4" /> Request Another Project
              </Button>
            </Link>
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
