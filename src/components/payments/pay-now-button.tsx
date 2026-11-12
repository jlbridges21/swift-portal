"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { paymentCheckoutPath, paymentReceiptHref } from "@/lib/payment-status";
import { EmbeddedCheckoutModal, postStartCheckout } from "@/components/payments/embedded-checkout-modal";

/** "Pay Now" that opens ShootPortal's embedded checkout instead of redirecting to Stripe. */
export function PayNowButton({ paymentId, title, className }: { paymentId: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const startCheckout = useCallback(
    ({ method }: { method: "card" | "bank" }) => postStartCheckout(paymentCheckoutPath(paymentId), { method, embedded: true }),
    [paymentId]
  );
  return (
    <>
      <Button variant="accent" size="sm" className={className} onClick={() => setOpen(true)}>
        Pay Now
      </Button>
      <EmbeddedCheckoutModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        startCheckout={startCheckout}
        statusUrl={(sessionId) => `${paymentCheckoutPath(paymentId)}/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`}
        title={title}
        onSettled={() => router.refresh()}
        fallbackReceiptHref={paymentReceiptHref(paymentId)}
      />
    </>
  );
}
