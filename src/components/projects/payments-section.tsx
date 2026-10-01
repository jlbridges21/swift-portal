"use client";

import { useState } from "react";
import type { Payment, ProjectQuote } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { paymentCheckoutPath } from "@/lib/payment-status";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { clientPayChoice, paidCentsForQuote } from "@/lib/payment-quote";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";
import { toast } from "sonner";

/** Payment awaiting client action (link sent but not yet paid). */
export function isOutstandingPayment(status: string): boolean {
  return status === "pending" || status === "sent";
}

interface PaymentsSectionProps {
  payments: Payment[];
  quotes?: ProjectQuote[];
  isPreview?: boolean;
  alwaysShow?: boolean;
  depositMode?: PaymentAutomationSettings["depositMode"];
  depositPercent?: number;
  depositAmountCents?: number;
  allowClientPayInFull?: boolean;
}

function quoteForPayment(quotes: ProjectQuote[], payment: Payment): ProjectQuote | undefined {
  if (!payment.quote_id) return undefined;
  return quotes.find((quote) => quote.id === payment.quote_id);
}

export function CheckoutChoiceButtons({
  payment,
  choice,
}: {
  payment: Pick<Payment, "id" | "amount">;
  choice: { depositCents: number; totalCents: number; rowIsFull: boolean; offerPayInFull: boolean };
}) {
  const [pending, setPending] = useState<"full" | "deposit" | null>(null);

  async function start(next: "full" | "deposit") {
    if (pending) return;
    setPending(next);
    try {
      const res = await fetch(paymentCheckoutPath(payment.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ choice: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.error || "Could not start checkout");
      setPending(null);
    } catch {
      toast.error("Could not start checkout");
      setPending(null);
    }
  }

  const reverting = payment.amount > choice.depositCents;
  const depositLabel = reverting
    ? `Pay ${formatCurrency(choice.depositCents)} deposit instead`
    : `Pay ${formatCurrency(payment.amount)} deposit`;
  const fullLabel = `Pay ${formatCurrency(choice.totalCents)} in full`;

  if (!choice.offerPayInFull) {
    return (
      <Button
        variant="accent"
        className="min-h-11 w-full px-6 sm:w-auto"
        disabled={pending != null}
        onClick={() => start("deposit")}
      >
        {pending === "deposit" ? "Starting checkout…" : depositLabel}
      </Button>
    );
  }

  if (choice.rowIsFull) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <a href={paymentCheckoutPath(payment.id)}>
          <Button variant="accent" className="min-h-11 w-full px-6 sm:w-auto">
            {fullLabel}
          </Button>
        </a>
        <Button
          variant="outline"
          className="min-h-11 w-full px-6 sm:w-auto"
          disabled={pending != null}
          onClick={() => start("deposit")}
        >
          {pending === "deposit" ? "Starting checkout…" : depositLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <a href={paymentCheckoutPath(payment.id)}>
        <Button variant="accent" className="min-h-11 w-full px-6 sm:w-auto">
          {depositLabel}
        </Button>
      </a>
      <Button
        variant="outline"
        className="min-h-11 w-full px-6 sm:w-auto"
        disabled={pending != null}
        onClick={() => start("full")}
      >
        {pending === "full" ? "Starting checkout…" : fullLabel}
      </Button>
    </div>
  );
}

function PayChoices({
  payment,
  quote,
  paidCents,
  depositMode,
  depositPercent,
  depositAmountCents,
  allowClientPayInFull,
}: {
  payment: Payment;
  quote?: ProjectQuote;
  paidCents: number;
  depositMode: PaymentAutomationSettings["depositMode"];
  depositPercent: number;
  depositAmountCents: number;
  allowClientPayInFull: boolean;
}) {
  const choice = quote
    ? clientPayChoice({
        depositMode,
        depositPercent,
        depositAmountCents,
        allowClientPayInFull,
        payment,
        quoteTotalCents: quote.total_cents,
        paidCents,
      })
    : null;

  if (!choice) {
    return (
      <a href={paymentCheckoutPath(payment.id)}>
        <Button variant="accent" className="w-full min-h-11 sm:w-auto">
          Pay Now
        </Button>
      </a>
    );
  }

  return <CheckoutChoiceButtons payment={payment} choice={choice} />;
}

export function PaymentsSection({
  payments,
  quotes = [],
  isPreview,
  alwaysShow,
  depositMode = "none",
  depositPercent = 50,
  depositAmountCents = 0,
  allowClientPayInFull = false,
}: PaymentsSectionProps) {
  const brand = usePortalBrand();
  const outstanding = payments.filter((p) => isOutstandingPayment(p.status));
  const paid = payments.filter((p) => p.status === "paid");
  const cancelled = payments.filter((p) => p.status === "cancelled");

  if (!payments.length && !alwaysShow) return null;

  return (
    <section id="payments">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
        <CreditCard className="h-5 w-5" /> Payments
      </h2>

      {!payments.length ? (
        <EmptyState
          icon={CreditCard}
          title="No payment requested yet"
          description={`No payment has been requested yet. Once your project is approved, ${brand.name} will send your secure payment link here. You'll be able to pay online and immediately unlock your high-resolution downloads.`}
        />
      ) : (
      <div className="space-y-6">
        {outstanding.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Outstanding</h3>
            <div className="space-y-3">
              {outstanding.map((p) => (
                <Card key={p.id} className="border-orange-200 bg-gradient-to-r from-orange-50/80 to-white shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xl font-bold text-primary">{formatCurrency(p.amount)}</p>
                      <p className="text-sm text-muted mt-0.5">{p.description}</p>
                      {p.due_date && (
                        <p className="text-xs text-muted mt-1">Due {formatDate(p.due_date)}</p>
                      )}
                    </div>
                    {!isPreview && (
                      <PayChoices
                        payment={p}
                        quote={quoteForPayment(quotes, p)}
                        paidCents={p.quote_id ? paidCentsForQuote(payments, p.quote_id) : 0}
                        depositMode={depositMode}
                        depositPercent={depositPercent}
                        depositAmountCents={depositAmountCents}
                        allowClientPayInFull={allowClientPayInFull}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {paid.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Payment History</h3>
            <Card className="shadow-sm overflow-hidden">
              <div className="divide-y divide-border">
                {paid.map((p) => (
                  <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                        <Receipt className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-primary">{formatCurrency(p.amount)}</p>
                        <p className="text-sm text-muted">{p.description}</p>
                        <p className="text-xs text-muted mt-0.5">
                          Paid {p.paid_at ? formatDate(p.paid_at) : "—"}
                          {p.card_last4 ? ` · Card ending ${p.card_last4}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <Badge variant="success">Paid</Badge>
                      {p.stripe_receipt_url ? (
                        <a href={p.stripe_receipt_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            View receipt
                          </Button>
                        </a>
                      ) : (
                        <a href={`/api/payments/${p.id}/receipt`}>
                          <Button variant="outline" size="sm">
                            Payment record
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {cancelled.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Cancelled</h3>
            <div className="space-y-2">
              {cancelled.map((p) => (
                <Card key={p.id} className="opacity-60 shadow-sm">
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span>{formatCurrency(p.amount)} — {p.description}</span>
                    <Badge>Cancelled</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </section>
  );
}
