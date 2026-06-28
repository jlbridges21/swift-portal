import type { Payment, ProjectQuote } from "@/lib/types";
import { isOutstandingPayment } from "@/components/projects/payments-section";
import {
  getLatestOfficialQuote,
  getLatestPreliminaryQuote,
  getQuotePriceDisplay,
  hasOfficialProposal,
  isPreliminaryQuote,
} from "@/lib/quote-display";
import { formatCurrency } from "@/lib/utils";

export type WorkflowStepStatus =
  | "Not Started"
  | "Draft"
  | "Sent"
  | "Approved"
  | "Payment Sent"
  | "Paid";

export function preliminaryStepStatus(quote: ProjectQuote | null): WorkflowStepStatus {
  if (!quote) return "Not Started";
  if (quote.status === "draft") return "Draft";
  return "Sent";
}

export function officialStepStatus(quotes: ProjectQuote[]): WorkflowStepStatus {
  const official = getLatestOfficialQuote(quotes);
  if (!official) {
    return hasOfficialProposal(quotes) ? "Sent" : "Not Started";
  }
  if (official.status === "draft") return "Draft";
  if (official.status === "approved") return "Approved";
  if (official.status === "sent" || official.status === "changes_requested") return "Sent";
  return "Draft";
}

export function paymentStepStatus(payments: Payment[]): WorkflowStepStatus {
  if (!payments.length) return "Not Started";
  if (payments.some((p) => p.status === "paid")) return "Paid";
  if (payments.some((p) => isOutstandingPayment(p.status))) return "Payment Sent";
  return "Not Started";
}

export function workflowStatusVariant(
  status: WorkflowStepStatus
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "Paid":
    case "Approved":
      return "success";
    case "Sent":
    case "Payment Sent":
      return "warning";
    case "Draft":
      return "default";
    default:
      return "default";
  }
}

export function quoteSummaryLabel(quote: ProjectQuote | null): string {
  if (!quote) return "—";
  const { showPrice, priceLabel } = getQuotePriceDisplay(quote);
  return showPrice ? priceLabel : priceLabel || "Custom";
}

export function paymentSummaryLabel(payments: Payment[]): string {
  const outstanding = payments.filter((p) => isOutstandingPayment(p.status));
  const paid = payments.filter((p) => p.status === "paid");
  if (paid.length) return `${formatCurrency(paid.reduce((s, p) => s + p.amount, 0))} paid`;
  if (outstanding.length) return `${formatCurrency(outstanding[0].amount)} due`;
  return "—";
}

export function getWorkflowQuotes(quotes: ProjectQuote[]) {
  return {
    preliminary: getLatestPreliminaryQuote(quotes),
    official: getLatestOfficialQuote(quotes),
    officialExists: hasOfficialProposal(quotes),
  };
}

export function isPreliminary(quote: ProjectQuote) {
  return isPreliminaryQuote(quote);
}
