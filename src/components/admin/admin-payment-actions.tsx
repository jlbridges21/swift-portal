"use client";

import Link from "next/link";
import type { Payment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isOutstandingPayment } from "@/components/projects/payments-section";
import { useMarkPaymentPaid } from "@/lib/use-mark-payment-paid";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface AdminPaymentActionsProps {
  payment: Payment & { projects?: { project_name?: string } | null };
  onUpdated?: (payment: Payment) => void;
  onDeleted?: (paymentId: string) => void;
  showProjectLink?: boolean;
  showDelete?: boolean;
  className?: string;
}

export function AdminPaymentActions({
  payment,
  onUpdated,
  onDeleted,
  showProjectLink = true,
  showDelete = false,
  className,
}: AdminPaymentActionsProps) {
  const { markPaid, markingPaidId } = useMarkPaymentPaid({ onUpdated });
  const link = payment.payment_link_url || payment.stripe_payment_link_url;
  const canMarkPaid = isOutstandingPayment(payment.status);
  const projectName = payment.projects?.project_name;

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="font-medium text-primary">{payment.description}</p>
        {showProjectLink && payment.project_id && (
          <p className="text-xs text-muted mt-0.5">
            Project:{" "}
            <Link href={`/admin/projects/${payment.project_id}`} className="text-accent hover:underline">
              {projectName || "View project"}
            </Link>
          </p>
        )}
        <p className="text-xs text-muted mt-0.5">
          {formatDate(payment.created_at)}
          {payment.paid_at && ` · Paid ${formatDate(payment.paid_at)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <p className="font-medium">{formatCurrency(payment.amount)}</p>
        <span
          className={cn(
            "text-xs font-medium capitalize",
            payment.status === "paid"
              ? "text-emerald-600"
              : payment.status === "cancelled"
                ? "text-muted"
                : "text-amber-600"
          )}
        >
          {payment.status}
        </span>
        {canMarkPaid && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={!!markingPaidId}
            onClick={() => markPaid(payment)}
          >
            {markingPaidId === payment.id ? "Marking…" : "Mark as Paid"}
          </Button>
        )}
        {link && payment.status !== "paid" && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="min-h-11">
              Open Payment Link
            </Button>
          </a>
        )}
        {showDelete && onDeleted && (
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDeleted(payment.id)} aria-label="Delete payment">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
