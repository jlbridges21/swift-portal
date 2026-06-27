"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Payment } from "@/lib/types";
import { isOutstandingPayment } from "@/components/projects/payments-section";

export function useMarkPaymentPaid(options?: {
  onUpdated?: (payment: Payment) => void;
}) {
  const router = useRouter();
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const markPaid = useCallback(
    async (payment: Pick<Payment, "id" | "project_id" | "status">) => {
      if (markingPaidId) return false;
      if (!isOutstandingPayment(payment.status as string)) return false;

      setMarkingPaidId(payment.id);
      try {
        const res = await fetch(`/api/payments/${payment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ project_id: payment.project_id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const { alreadyPaid, ...updated } = data as Payment & { alreadyPaid?: boolean };
          options?.onUpdated?.(updated as Payment);
          toast.success(alreadyPaid ? "Payment was already marked as paid" : "Marked as paid");
          router.refresh();
          return true;
        }
        toast.error(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Failed to mark payment as paid"
        );
        return false;
      } catch {
        toast.error("Failed to mark payment as paid — network error");
        return false;
      } finally {
        setMarkingPaidId(null);
      }
    },
    [markingPaidId, options, router]
  );

  return { markPaid, markingPaidId };
}
