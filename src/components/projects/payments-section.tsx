"use client";

import type { Payment } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Download, ExternalLink, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Payment awaiting client action (link sent but not yet paid). */
export function isOutstandingPayment(status: string): boolean {
  return status === "pending" || status === "sent";
}

interface PaymentsSectionProps {
  payments: Payment[];
  isPreview?: boolean;
  alwaysShow?: boolean;
}

export function PaymentsSection({ payments, isPreview, alwaysShow }: PaymentsSectionProps) {
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
          description="No payment has been requested yet. Once your project is approved, Swift Aerial Media will send your secure payment link here. You'll be able to pay online and immediately unlock your high-resolution downloads."
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
                    {(p.stripe_payment_link_url || p.payment_link_url) && !isPreview && (
                      <a href={p.stripe_payment_link_url || p.payment_link_url || "#"} target="_blank" rel="noopener noreferrer">
                        <Button variant="accent" className="w-full min-h-11 sm:w-auto">
                          Pay Now <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    {!isPreview && !(p.stripe_payment_link_url || p.payment_link_url) && (
                      <p className="text-sm text-muted">Your payment link is being prepared — check back shortly.</p>
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
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <Badge variant="success">Paid</Badge>
                      {!isPreview && (
                        <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" /> Receipt
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
