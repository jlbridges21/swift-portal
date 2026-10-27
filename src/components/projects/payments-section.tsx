"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import type { Payment, ProjectQuote } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CreditCard, Landmark, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { paymentCheckoutPath, paymentMethodLabel } from "@/lib/payment-status";
import { cardFeeCents } from "@/lib/card-fee";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { clientPayChoice, paidCentsForQuote, resolveQuoteDepositTerms } from "@/lib/payment-quote";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";
import { toast } from "sonner";

/** Payment awaiting client action (link sent but not yet paid). */
export function isOutstandingPayment(status: string): boolean {
  return status === "pending" || status === "sent";
}

/** How this business takes payment: bank (ACH) when its Stripe account allows it, and whether clients pay the card fee. */
export type ClientPaymentOptions = { bankAvailable: boolean; passCardFee: boolean };

const PaymentOptionsContext = createContext<ClientPaymentOptions>({ bankAvailable: false, passCardFee: false });

export function PaymentOptionsProvider({ value, children }: { value: ClientPaymentOptions; children: ReactNode }) {
  return <PaymentOptionsContext.Provider value={value}>{children}</PaymentOptionsContext.Provider>;
}

type PayMethod = "card" | "bank";

/** Card or bank choice, shown only when the business accepts bank payments. */
function PayMethodPicker({ method, onChange, sampleCents }: { method: PayMethod; onChange: (m: PayMethod) => void; sampleCents: number }) {
  const { bankAvailable, passCardFee } = useContext(PaymentOptionsContext);
  const labelId = useId();
  const fee = passCardFee ? cardFeeCents(sampleCents) : 0;
  if (!bankAvailable) {
    return fee > 0 ? (
      <p className="text-xs text-muted">A {formatCurrency(fee)} card processing fee is added at checkout.</p>
    ) : null;
  }
  const options: { value: PayMethod; title: string; detail: string; icon: typeof CreditCard }[] = [
    { value: "card", title: "Card", detail: fee > 0 ? `+${formatCurrency(fee)} card fee` : "Credit or debit", icon: CreditCard },
    { value: "bank", title: "Bank account", detail: "No fee · ACH", icon: Landmark },
  ];
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-xs font-medium text-muted">
        Pay with
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = method === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border bg-background hover:border-accent/50"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", on ? "text-accent" : "text-muted")} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-heading">{o.title}</span>
                <span className="block text-xs text-muted">{o.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted" aria-live="polite">
        {method === "bank"
          ? "Connect your bank securely through Stripe. Your payment shows as processing and usually clears in a few business days."
          : fee > 0
            ? `Includes a card processing fee. Pay by bank account to avoid it.`
            : "Pay securely by card through Stripe."}
      </p>
    </div>
  );
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
  choice: { depositCents: number; totalCents: number; rowIsFull: boolean; offerPayInFull: boolean } | null;
}) {
  const { passCardFee } = useContext(PaymentOptionsContext);
  const [pending, setPending] = useState<"full" | "deposit" | "default" | null>(null);
  const [method, setMethod] = useState<PayMethod>("card");

  async function start(next: "full" | "deposit" | "default") {
    if (pending) return;
    setPending(next);
    try {
      const res = await fetch(paymentCheckoutPath(payment.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...(next === "default" ? {} : { choice: next }), method }),
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

  /** Button label; card payments show the fee the client will pay on top. */
  const label = (text: string, cents: number) => {
    const fee = method === "card" && passCardFee ? cardFeeCents(cents) : 0;
    return fee > 0 ? `${text} + ${formatCurrency(fee)} fee` : text;
  };
  const busyLabel = method === "bank" ? "Opening bank checkout…" : "Starting checkout…";

  const buttons: { key: "full" | "deposit" | "default"; text: string; cents: number; primary: boolean }[] = [];
  if (!choice) {
    buttons.push({ key: "default", text: `Pay ${formatCurrency(payment.amount)}`, cents: payment.amount, primary: true });
  } else {
    const reverting = payment.amount > choice.depositCents;
    const depositText = reverting ? `Pay ${formatCurrency(choice.depositCents)} deposit instead` : `Pay ${formatCurrency(payment.amount)} deposit`;
    const fullText = `Pay ${formatCurrency(choice.totalCents)} in full`;
    if (!choice.offerPayInFull) {
      buttons.push({ key: "deposit", text: depositText, cents: reverting ? choice.depositCents : payment.amount, primary: true });
    } else if (choice.rowIsFull) {
      buttons.push({ key: "default", text: fullText, cents: choice.totalCents, primary: true });
      buttons.push({ key: "deposit", text: depositText, cents: choice.depositCents, primary: false });
    } else {
      buttons.push({ key: "default", text: depositText, cents: payment.amount, primary: true });
      buttons.push({ key: "full", text: fullText, cents: choice.totalCents, primary: false });
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:w-80">
      <PayMethodPicker method={method} onChange={setMethod} sampleCents={buttons[0]?.cents ?? payment.amount} />
      <div className="flex flex-col gap-2">
        {buttons.map((b) => (
          <Button
            key={b.key}
            variant={b.primary ? "accent" : "outline"}
            className="min-h-11 w-full px-6"
            disabled={pending != null}
            onClick={() => start(b.key)}
          >
            {pending === b.key ? busyLabel : label(b.text, b.cents)}
          </Button>
        ))}
      </div>
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
        terms: resolveQuoteDepositTerms(quote, { depositMode, depositPercent, depositAmountCents }),
        allowClientPayInFull,
        payment,
        quoteTotalCents: quote.total_cents,
        paidCents,
      })
    : null;

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
  const processing = payments.filter((p) => p.status === "processing");
  const paid = payments.filter((p) => p.status === "paid");
  const cancelled = payments.filter((p) => p.status === "cancelled");

  if (!payments.length && !alwaysShow) return null;

  return (
    <section id="payments">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-heading">
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
                <Card key={p.id} className="border-orange-200 bg-gradient-to-r from-orange-50/80 to-white shadow-sm surface-dark:from-background surface-dark:to-background">
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xl font-bold text-heading">{formatCurrency(p.amount)}</p>
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

        {processing.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Processing</h3>
            <div className="space-y-3">
              {processing.map((p) => (
                <Card key={p.id} className="border-sky-200 bg-gradient-to-r from-sky-50/80 to-white shadow-sm surface-dark:from-background surface-dark:to-background">
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100">
                        <Clock className="h-4 w-4 text-sky-700" aria-hidden />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-heading">{formatCurrency(p.amount)}</p>
                        <p className="text-sm text-muted mt-0.5">{p.description}</p>
                        <p className="text-xs text-muted mt-1">
                          Bank payment{p.processing_started_at ? ` started ${formatDate(p.processing_started_at)}` : ""} · usually clears in a few business days
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning" className="self-start sm:self-center">Processing</Badge>
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
                        <p className="font-medium text-heading">{formatCurrency(p.amount)}</p>
                        <p className="text-sm text-muted">{p.description}</p>
                        <p className="text-xs text-muted mt-0.5">
                          Paid {p.paid_at ? formatDate(p.paid_at) : "—"}
                          {paymentMethodLabel(p) ? ` · ${paymentMethodLabel(p)}` : ""}
                          {p.client_fee_cents ? ` · plus ${formatCurrency(p.client_fee_cents)} card fee` : ""}
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
