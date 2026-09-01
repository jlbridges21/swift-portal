"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function checkoutErrorMessage(
  status: number,
  data: { error?: string; code?: string }
): string {
  // A 402 here means the paywall gate caught checkout — misleading if we show
  // the trial-ended reason as if it were why Stripe failed.
  if (status === 402 || data.code === "subscription_required") {
    return "Checkout was blocked before it could start. Refresh the page and try again. If this keeps happening, contact support.";
  }
  if (data.error?.trim()) return data.error.trim();
  return "Could not start checkout.";
}

export function SubscribeButton({
  planKey,
  interval = "monthly",
  disabled,
  label,
  promoCode,
}: {
  planKey: string;
  interval?: "monthly" | "annual";
  disabled?: boolean;
  label: string;
  /** Applied partner promo code from billing UI (optional). */
  promoCode?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          interval,
          ...(promoCode ? { promoCode } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.url) {
        setError(checkoutErrorMessage(res.status, data));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        className="w-full"
        disabled={disabled || loading}
        onClick={onClick}
      >
        {loading ? "Redirecting…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.url) {
        if (res.status === 402 || data.code === "subscription_required") {
          setError(
            "Billing portal was blocked before it could open. Refresh and try again, or contact support."
          );
        } else {
          setError(data.error?.trim() || "Could not open billing portal.");
        }
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" disabled={loading} onClick={onClick}>
        {loading ? "Opening…" : "Manage billing"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
