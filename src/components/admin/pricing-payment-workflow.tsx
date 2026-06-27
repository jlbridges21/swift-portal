"use client";

import Link from "next/link";
import type { Payment, Project, ProjectQuote } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  getWorkflowQuotes,
  officialStepStatus,
  paymentStepStatus,
  paymentSummaryLabel,
  preliminaryStepStatus,
  quoteSummaryLabel,
  workflowStatusVariant,
  type WorkflowStepStatus,
} from "@/lib/pricing-workflow";
import { isOutstandingPayment } from "@/components/projects/payments-section";
import { ArrowDown, CreditCard, FileText, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingPaymentWorkflowProps {
  project: Pick<Project, "id" | "project_name" | "property_address">;
  quotes: ProjectQuote[];
  payments: Payment[];
  onScrollToQuote?: () => void;
  onScrollToPayments?: () => void;
}

function StepBadge({ status }: { status: WorkflowStepStatus }) {
  return <Badge variant={workflowStatusVariant(status)}>{status}</Badge>;
}

function WorkflowStep({
  step,
  title,
  status,
  summary,
  children,
}: {
  step: number;
  title: string;
  status: WorkflowStepStatus;
  summary: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Step {step}</p>
          <p className="mt-1 font-semibold text-primary">{title}</p>
          <p className="mt-1 text-sm text-muted truncate">{summary}</p>
        </div>
        <StepBadge status={status} />
      </div>
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function PricingPaymentWorkflow({
  project,
  quotes,
  payments,
  onScrollToQuote,
  onScrollToPayments,
}: PricingPaymentWorkflowProps) {
  const { preliminary, official } = getWorkflowQuotes(quotes);
  const prelimStatus = preliminaryStepStatus(preliminary);
  const officialStatus = officialStepStatus(quotes);
  const payStatus = paymentStepStatus(payments);
  const latestPayment = payments[0] ?? null;
  const outstanding = payments.find((p) => isOutstandingPayment(p.status));

  return (
    <Card id="pricing-payment" className="scroll-mt-24 border-0 shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
      <CardHeader className="border-b border-border/60 bg-white pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5 text-accent" />
            Pricing &amp; Payment
          </CardTitle>
          <p className="text-sm text-muted">{project.project_name}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 bg-white p-4 sm:p-6">
        <WorkflowStep
          step={1}
          title="Preliminary Quote"
          status={prelimStatus}
          summary={preliminary ? preliminary.title : "Auto-generated on project request"}
        >
          {preliminary && (
            <span className="text-sm font-medium text-primary">{quoteSummaryLabel(preliminary)}</span>
          )}
          <Button variant="outline" size="sm" className="min-h-10" onClick={onScrollToQuote} asChild>
            <a href="#quote">View / Edit</a>
          </Button>
        </WorkflowStep>

        <div className="flex justify-center py-0.5 text-muted">
          <ArrowDown className="h-4 w-4" aria-hidden />
        </div>

        <WorkflowStep
          step={2}
          title="Official Estimate"
          status={officialStatus}
          summary={official ? official.title : "Convert preliminary or create proposal"}
        >
          {official && (
            <span className="text-sm font-medium text-primary">{quoteSummaryLabel(official)}</span>
          )}
          <Button variant="outline" size="sm" className="min-h-10" onClick={onScrollToQuote} asChild>
            <a href="#quote">{official ? "Manage Estimate" : "Create Estimate"}</a>
          </Button>
        </WorkflowStep>

        <div className="flex justify-center py-0.5 text-muted">
          <ArrowDown className="h-4 w-4" aria-hidden />
        </div>

        <WorkflowStep
          step={3}
          title="Payment"
          status={payStatus}
          summary={
            latestPayment
              ? `${latestPayment.description} · ${paymentSummaryLabel(payments)}`
              : "Create a payment link after approval"
          }
        >
          {outstanding && (
            <span className="text-sm font-medium text-amber-700">
              {formatCurrency(outstanding.amount)} outstanding
            </span>
          )}
          <Button variant="outline" size="sm" className="min-h-10" onClick={onScrollToPayments} asChild>
            <a href="#payments">
              <CreditCard className="h-4 w-4" /> {payments.length ? "Manage Payments" : "Create Payment"}
            </a>
          </Button>
          {latestPayment?.project_id && (
            <Button variant="ghost" size="sm" className="min-h-10" asChild>
              <Link href={`/admin/projects/${project.id}#payments`}>View Project</Link>
            </Button>
          )}
        </WorkflowStep>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-muted">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          Quote → Estimate → Payment — use the sections below to edit details and send to clients.
        </div>
      </CardContent>
    </Card>
  );
}
