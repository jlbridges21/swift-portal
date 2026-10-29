"use client";

import { useEffect, useState } from "react";
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
  if (data.code === "already_subscribed") {
    return "Your plan is already set up. Refresh this page to see it, or use Manage billing.";
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
  context,
  variant = "default",
  className,
}: {
  planKey: string;
  interval?: "monthly" | "annual";
  disabled?: boolean;
  label: string;
  /** Applied partner promo code from billing UI (optional). */
  promoCode?: string | null;
  /** Where the plan was picked (attribution only), e.g. "billing", "modal_day5". */
  context?: string;
  variant?: "default" | "accent" | "outline";
  className?: string;
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
          ...(context ? { context } : {}),
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
        variant={variant}
        className={className ?? "w-full"}
        disabled={disabled || loading}
        onClick={onClick}
      >
        {loading ? "Redirecting to secure checkout…" : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
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

/** Subscribe Now account that hasn't paid: one-time switch to the free trial. */
export function StartTrialInsteadButton({ trialDays }: { trialDays: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/start-trial", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error?.trim() || "Could not start your trial. Please try again.");
        return;
      }
      window.location.href = "/onboarding";
    } catch {
      setError("Could not start your trial. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="link" className="h-auto p-0" disabled={loading} onClick={onClick}>
        {loading ? "Starting your trial…" : `Start Free Trial — ${trialDays} days, no credit card required`}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Stripe confirmed checkout but the subscription isn't visible yet — re-check a few times. */
export function CheckoutConfirmationRefresher({ attempt }: { attempt: number }) {
  useEffect(() => {
    if (attempt >= 6) return;
    const t = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("attempt", String(attempt + 1));
      window.location.replace(url.toString());
    }, 2500);
    return () => window.clearTimeout(t);
  }, [attempt]);
  return null;
}
