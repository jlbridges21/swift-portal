"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Payment, ProjectQuote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  canCreatePaymentFromQuote,
  defaultPaymentLinkDescription,
  getPaymentForQuote,
  paymentLinkTitle,
} from "@/lib/payment-quote";
import { CreditCard, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ProposalPaymentLinkActionsProps {
  quote: ProjectQuote;
  projectId: string;
  clientId: string;
  projectName: string;
  clientName: string;
  propertyAddress: string;
  serviceType?: string;
  payments: Payment[];
  onPaymentCreated?: (payment: Payment) => void;
}

export function ProposalPaymentLinkActions({
  quote,
  projectId,
  clientId,
  clientName,
  propertyAddress,
  serviceType,
  payments,
  onPaymentCreated,
}: ProposalPaymentLinkActionsProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkDescription, setLinkDescription] = useState("");
  const [localPayment, setLocalPayment] = useState<Payment | null>(() =>
    getPaymentForQuote(payments, quote.id)
  );

  const linkTitle = paymentLinkTitle(clientName, propertyAddress, serviceType || "Service");

  useEffect(() => {
    const fromProps = getPaymentForQuote(payments, quote.id);
    if (fromProps) setLocalPayment(fromProps);
  }, [payments, quote.id]);

  useEffect(() => {
    if (showModal) {
      setLinkDescription(defaultPaymentLinkDescription(serviceType));
    }
  }, [showModal, serviceType]);

  const linkedPayment = localPayment ?? getPaymentForQuote(payments, quote.id);
  const paymentUrl = linkedPayment?.payment_link_url || linkedPayment?.stripe_payment_link_url;
  const canCreate = canCreatePaymentFromQuote(quote);

  if (!canCreate && !linkedPayment) return null;

  async function createPaymentLink() {
    if (creating || linkedPayment) return;
    setCreating(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          client_id: clientId,
          quote_id: quote.id,
          amount: quote.total_cents,
          description: linkTitle,
          product_description: linkDescription.trim().slice(0, 250),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const payment = data as Payment;
        setLocalPayment(payment);
        onPaymentCreated?.(payment);
        setShowModal(false);
        toast.success("Payment link created.");
        router.refresh();
      } else {
        toast.error(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Could not create payment link. Check Stripe settings."
        );
      }
    } finally {
      setCreating(false);
    }
  }

  function copyLink() {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied");
  }

  if (linkedPayment && paymentUrl) {
    return (
      <div className="flex flex-wrap gap-2">
        <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="accent" size="sm" className="min-h-11">
            <ExternalLink className="h-4 w-4" /> View Payment Link
          </Button>
        </a>
        <Button variant="outline" size="sm" className="min-h-11" onClick={copyLink}>
          <Copy className="h-4 w-4" /> Copy Payment Link
        </Button>
      </div>
    );
  }

  if (!canCreate) return null;

  return (
    <>
      <Button variant="accent" size="sm" className="min-h-11" onClick={() => setShowModal(true)}>
        <CreditCard className="h-4 w-4" /> Create Payment Link
      </Button>

      <Modal open={showModal} onClose={() => !creating && setShowModal(false)} title="Create Payment Link">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Payment title</p>
            <p className="mt-1 font-medium text-primary break-words">{linkTitle}</p>
            <p className="mt-3 text-2xl font-bold text-primary">{formatCurrency(quote.total_cents)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-link-description">Description</Label>
            <Textarea
              id="payment-link-description"
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              rows={3}
              className="min-h-[5rem] resize-y"
              placeholder="What the client is paying for…"
            />
            <p className="text-xs text-muted">Shown under the amount in Stripe checkout.</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11" disabled={creating} onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              className="min-h-11"
              disabled={creating || !linkDescription.trim()}
              onClick={createPaymentLink}
            >
              {creating ? "Creating…" : "Create Payment Link"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
