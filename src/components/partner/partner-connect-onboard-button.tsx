"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { PartnerConnectAccountStatus } from "@/lib/partner-stripe-connect";

export function PartnerConnectOnboardButton({
  status,
}: {
  status: PartnerConnectAccountStatus;
}) {
  const [busy, setBusy] = useState(false);
  const label =
    status === "not_connected" || status === "disabled"
      ? "Connect with Stripe"
      : status === "ready"
        ? "Update payout details in Stripe"
        : "Continue Stripe onboarding";

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/partner/stripe/connect", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error || "Could not start Stripe onboarding.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start Stripe onboarding.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="accent" className="min-h-11" disabled={busy} onClick={() => void start()}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
