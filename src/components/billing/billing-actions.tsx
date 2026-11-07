"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/trial-conversion";

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
  if (data.code === "offer_unavailable" && data.error?.trim()) return data.error.trim();
  if (data.error?.trim()) return data.error.trim();
  return "Could not start checkout.";
}

export function SubscribeButton({
  planKey,
  interval = "monthly",
  disabled,
  label,
  promoCode,
  expectedOffer,
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
  /** The offer whose price the customer is looking at: "intro" | "referral" | "none". */
  expectedOffer?: string;
  /** Where the plan was picked (attribution only), e.g. "billing", "modal_day5". */
  context?: string;
  variant?: "default" | "accent" | "outline";
  className?: string;
}) {
  const router = useRouter();
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
          ...(expectedOffer ? { expectedOffer } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.url) {
        setError(checkoutErrorMessage(res.status, data));
        // The offer changed (e.g. the trial window just closed): show the current prices.
        if (data.code === "offer_unavailable" && res.status === 409) router.refresh();
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
      <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-nowrap border-accent px-5 font-semibold text-accent"
        disabled={loading}
        onClick={onClick}
        aria-label={`Start a ${trialDays}-day free trial, no credit card required`}
      >
        {loading ? "Starting your trial…" : "Start Free Trial"}
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

/**
 * Subscribe Now signups: open Stripe Checkout for the plan they picked at signup, without an
 * extra click. Runs once per account (the server only renders this before any checkout exists);
 * on failure it falls back to the normal plan picker.
 */
export function AutoStartCheckout({ planKey, interval }: { planKey: string; interval: "monthly" | "annual" }) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planKey, interval, context: "signup" }),
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        if (!cancelled && res.ok && data.url) {
          window.location.replace(data.url);
          return;
        }
      } catch {
        /* fall through to the picker */
      }
      if (!cancelled) window.location.replace(`/billing?checkout=error&plan=${interval}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [planKey, interval]);
  return null;
}

type StartNowQuote = {
  interval: "monthly" | "annual" | null;
  regularCents: number;
  chargeTodayCents: number;
  savingsCents: number;
  withIntro: boolean;
  keepsExistingDiscount: boolean;
  scheduledFirstPaymentAt: string | null;
};

/**
 * Pre-existing plan scheduled for trial end: optionally start it today (at the Subscribe & Save
 * price when eligible). Requires an explicit checkbox + button; nothing happens otherwise and the
 * plan keeps its original date and price.
 */
export function StartPlanNowPanel({
  scheduledDateLabel,
  scheduledAmountCents,
}: {
  /** "November 20" — the original first payment date. */
  scheduledDateLabel: string;
  scheduledAmountCents: number | null;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<StartNowQuote | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/start-plan-now", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { quote?: StartNowQuote };
        // Not startable (already started, nothing scheduled): show nothing.
        if (!cancelled && res.ok && data.quote) setQuote(data.quote);
      } catch {
        /* offer hidden — the scheduled plan is unaffected */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quote) return null;

  const plan = quote.interval === "annual" ? "annual" : "monthly";
  const renews =
    quote.interval === "annual"
      ? `Renews at ${formatUsd(quote.regularCents)}/year`
      : quote.withIntro
        ? `${formatUsd(quote.chargeTodayCents)}/month for your first 3 months, then ${formatUsd(quote.regularCents)}/month`
        : `${formatUsd(quote.regularCents)}/month`;

  async function confirm() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/start-plan-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, expectedChargeCents: quote.chargeTodayCents }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; code?: string; quote?: StartNowQuote };
      if (res.ok && data.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      if (data.code === "amount_changed" && data.quote) {
        setQuote(data.quote);
        setAgreed(false);
      }
      if (data.code === "already_started") router.refresh();
      setError(data.error?.trim() || "We couldn't start your plan. Nothing was charged.");
    } catch {
      setError("Connection problem — nothing was charged. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mb-8 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-950" role="status">
        <p className="font-semibold">Your {plan} plan is active.</p>
        <p className="mt-1">
          {formatUsd(quote.chargeTodayCents)} was charged to your card on file. Your free trial has ended and your
          billing cycle starts today. A receipt is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">
        {quote.withIntro ? "Subscribe & Save" : "Optional"}
      </p>
      <h2 className="mt-1 text-lg font-bold text-heading">
        {quote.withIntro
          ? `Start your plan today and save ${formatUsd(quote.savingsCents)}`
          : "Start your plan today"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Your {plan} plan is scheduled to start on {scheduledDateLabel}
        {scheduledAmountCents != null ? ` at ${formatUsd(scheduledAmountCents)}` : ""}. That stays exactly as it is
        unless you choose to start now.
      </p>
      <dl className="mt-4 grid gap-2 rounded-lg bg-card p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Charged today</dt>
          <dd className="text-xl font-bold text-heading">
            {quote.withIntro ? (
              <span className="mr-1.5 text-sm font-normal text-muted line-through">{formatUsd(quote.regularCents)}</span>
            ) : null}
            {formatUsd(quote.chargeTodayCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">After that</dt>
          <dd className="text-heading">{renews}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Instead of</dt>
          <dd className="text-heading">
            {scheduledAmountCents != null ? `${formatUsd(scheduledAmountCents)} on ` : ""}
            {scheduledDateLabel}
          </dd>
        </div>
      </dl>
      <label className="mt-4 flex items-start gap-2 text-sm text-heading">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>
          I authorize ShootPortal to charge {formatUsd(quote.chargeTodayCents)} to my card on file today. This ends my
          free trial now and my billing cycle starts today.
        </span>
      </label>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" variant="accent" className="min-h-11" disabled={!agreed || busy} onClick={() => void confirm()}>
          {busy ? "Processing payment…" : `Pay ${formatUsd(quote.chargeTodayCents)} and start now`}
        </Button>
        <span className="text-xs text-muted">Not now? Do nothing — your plan starts on {scheduledDateLabel} as planned.</span>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
