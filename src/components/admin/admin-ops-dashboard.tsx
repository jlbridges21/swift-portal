import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { formatShootDateTime } from "@/lib/scheduling";
import {
  type AdminDashboardData,
  type AdminDashboardProjectRow,
  type AdminPaymentRow,
  type AdminQuoteAttentionRow,
} from "@/lib/admin-dashboard";
import { pipelineStageHref } from "@/lib/admin-project-pipeline";
import {
  ArrowRight,
  Calendar,
  Camera,
  CreditCard,
  FileText,
  FolderKanban,
  Inbox,
  Pencil,
  Send,
  Truck,
  Upload,
  Users,
} from "lucide-react";

interface AdminOpsDashboardProps {
  data: AdminDashboardData;
}

const QUICK_ACTIONS = [
  { label: "New Project", href: "/admin/projects/new", icon: FolderKanban, variant: "accent" as const },
  { label: "New Client", href: "/admin/clients/new", icon: Users, variant: "outline" as const },
  { label: "Upload Media", href: "/admin/media", icon: Upload, variant: "outline" as const },
  { label: "All Projects", href: "/admin/projects", icon: FileText, variant: "outline" as const },
];

export function AdminOpsDashboard({ data }: AdminOpsDashboardProps) {
  const statCards = [
    {
      label: "New Requests",
      value: data.counts.newRequests,
      href: pipelineStageHref("new_request"),
      icon: Inbox,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Quotes",
      value: data.counts.quotesWaiting,
      href: pipelineStageHref("quote"),
      icon: FileText,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Upcoming Shoots",
      value: data.counts.upcomingShoots,
      href: pipelineStageHref("upcoming_shoot"),
      icon: Calendar,
      color: "text-sky-600 bg-sky-50",
    },
    {
      label: "Editing",
      value: data.counts.editingQueue,
      href: pipelineStageHref("editing"),
      icon: Pencil,
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "In Review",
      value: data.counts.inReview,
      href: pipelineStageHref("in_review"),
      icon: Camera,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Awaiting Payment",
      value: data.counts.awaitingPayment,
      href: pipelineStageHref("awaiting_payment"),
      icon: CreditCard,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant={action.variant} size="sm" className="min-h-11">
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          </Link>
        ))}
      </div>

      <div className="mb-10 grid w-full max-w-full min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="min-w-0">
            <Card className="h-full w-full max-w-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-4">
                <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted break-words">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid w-full max-w-full min-w-0 gap-6 lg:grid-cols-2">
        <DashboardSection
          title="New Requests"
          icon={Inbox}
          href={pipelineStageHref("new_request")}
          emptyMessage="No new requests — you're caught up"
          isEmpty={data.newRequests.length === 0}
        >
          {data.newRequests.map((p) => (
            <ProjectRow key={p.id} project={p} meta={formatRelativeTime(p.created_at)} />
          ))}
        </DashboardSection>

        <DashboardSection
          title="Quotes Needing Attention"
          icon={Send}
          href="/admin/projects"
          emptyMessage="All quotes are up to date"
          isEmpty={data.quoteAttention.length === 0}
        >
          {data.quoteAttention.map((item) => (
            <QuoteAttentionRow key={item.id} item={item} />
          ))}
        </DashboardSection>

        <DashboardSection
          title="Upcoming Shoots"
          icon={Calendar}
          href={pipelineStageHref("upcoming_shoot")}
          emptyMessage="No shoots scheduled in the next two weeks"
          isEmpty={data.upcomingShoots.length === 0}
        >
          {data.upcomingShoots.map((p) => (
            <ProjectRow
              key={`shoot-${p.id}`}
              project={p}
              meta={formatShootDateTime(p.shootAt, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            />
          ))}
        </DashboardSection>

        <DashboardSection
          title="Editing Queue"
          icon={Pencil}
          href={pipelineStageHref("editing")}
          emptyMessage="Editing queue is clear"
          isEmpty={data.editingQueue.length === 0}
        >
          {data.editingQueue.map((p) => (
            <ProjectRow key={`edit-${p.id}`} project={p} meta={`Updated ${formatRelativeTime(p.updated_at)}`} />
          ))}
        </DashboardSection>

        <DashboardSection
          title="Ready for Delivery"
          icon={Truck}
          href={pipelineStageHref("in_review")}
          emptyMessage="Nothing waiting for delivery"
          isEmpty={data.readyForDelivery.length === 0}
        >
          {data.readyForDelivery.map((p) => (
            <ProjectRow key={`delivery-${p.id}`} project={p} showStatus />
          ))}
        </DashboardSection>

        <DashboardSection
          title="Payment Status"
          icon={CreditCard}
          href={pipelineStageHref("awaiting_payment")}
          emptyMessage="No outstanding payments"
          isEmpty={
            data.outstandingPayments.length === 0 &&
            data.recentlyPaid.length === 0 &&
            data.expiredPayments.length === 0
          }
        >
          {data.outstandingPayments.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">Outstanding</p>
              {data.outstandingPayments.map((pay) => (
                <PaymentRow key={`out-${pay.id}`} payment={pay} />
              ))}
            </div>
          )}
          {data.recentlyPaid.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Recently Paid</p>
              {data.recentlyPaid.map((pay) => (
                <PaymentRow key={`paid-${pay.id}`} payment={pay} paid />
              ))}
            </div>
          )}
          {data.expiredPayments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Expired Links</p>
              {data.expiredPayments.map((pay) => (
                <PaymentRow key={`exp-${pay.id}`} payment={pay} expired />
              ))}
            </div>
          )}
        </DashboardSection>
      </div>
    </>
  );
}

function DashboardSection({
  title,
  icon: Icon,
  href,
  emptyMessage,
  isEmpty,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  emptyMessage: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-full overflow-hidden">
      <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="truncate">{title}</span>
        </CardTitle>
        <Link href={href} className="shrink-0 text-xs text-accent hover:underline flex items-center gap-0.5">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="min-w-0 space-y-2 pt-0">
        {!isEmpty ? children : (
          <p className="py-4 text-center text-sm text-muted">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectRow({
  project,
  meta,
  showStatus,
}: {
  project: AdminDashboardProjectRow;
  meta?: string;
  showStatus?: boolean;
}) {
  return (
    <Link href={`/admin/projects/${project.id}`} className="block min-w-0">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary break-words">{project.project_name}</p>
          <p className="mt-0.5 text-xs text-muted break-words">
            {project.clients?.name}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        {showStatus && (
          <StatusBadge status={project.status} className="shrink-0 self-start sm:self-center" />
        )}
      </div>
    </Link>
  );
}

function QuoteAttentionRow({ item }: { item: AdminQuoteAttentionRow }) {
  return (
    <Link href={`/admin/projects/${item.project_id}#quote`} className="block min-w-0">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary break-words">{item.project_name}</p>
          <p className="mt-0.5 text-xs text-muted break-words">
            {item.client_name ?? "Unknown client"} · {formatRelativeTime(item.updated_at)}
          </p>
        </div>
        <span className="shrink-0 self-start rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 sm:self-center">
          {item.attentionLabel}
        </span>
      </div>
    </Link>
  );
}

function PaymentRow({
  payment,
  paid,
  expired,
}: {
  payment: AdminPaymentRow;
  paid?: boolean;
  expired?: boolean;
}) {
  const project = payment.projects;
  return (
    <Link
      href={project ? `/admin/projects/${project.id}#payments` : "/admin/projects"}
      className="mb-2 block min-w-0 last:mb-0"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-slate-50">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{formatCurrency(payment.amount)}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {project?.project_name ?? payment.description}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            paid
              ? "bg-emerald-50 text-emerald-700"
              : expired
                ? "bg-red-50 text-red-700"
                : "bg-orange-50 text-orange-700"
          }`}
        >
          {paid ? "Paid" : expired ? "Expired" : formatDate(payment.created_at)}
        </span>
      </div>
    </Link>
  );
}
