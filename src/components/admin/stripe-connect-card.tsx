"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, ExternalLink, Landmark, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ConnectStatus = "not_connected" | "pending" | "active" | "restricted" | "disabled";

interface ConnectState {
  isPlatform: boolean;
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  connectedAt: string | null;
  hasAccount: boolean;
  dashboardUrl: string;
  achEnabled?: boolean;
  achSettingsUrl?: string;
}

type PillTone = "good" | "warn" | "bad" | "neutral";

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "good" && "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300",
        tone === "warn" && "bg-amber-50 text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300",
        tone === "bad" && "bg-red-50 text-red-700 surface-dark:bg-red-500/15 surface-dark:text-red-300",
        tone === "neutral" && "bg-subtle text-muted"
      )}
    >
      {children}
    </span>
  );
}

function statusPill(state: ConnectState): { tone: PillTone; label: string } {
  if (state.isPlatform) return { tone: "good", label: "Platform account" };
  if (!state.hasAccount) return { tone: "neutral", label: "Not connected" };
  switch (state.status) {
    case "active":
      return { tone: "good", label: "Connected" };
    case "pending":
      return { tone: "warn", label: "Setup in progress" };
    case "restricted":
      return { tone: "warn", label: "Action needed" };
    case "disabled":
      return { tone: "bad", label: "Disabled" };
    default:
      return { tone: "neutral", label: "Not connected" };
  }
}

export function StripeConnectCard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [state, setState] = useState<ConnectState | null>(null);
  const [checking, setChecking] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setState(data as ConnectState);
    } finally {
      setLoading(false);
    }
  }

  /** Re-read the account from Stripe after the owner turns on ACH there. */
  async function checkBankPayments() {
    setChecking(true);
    try {
      const res = await fetch("/api/stripe/connect", { credentials: "include" });
      const data = (await res.json()) as ConnectState;
      if (res.ok) {
        setState(data);
        if (data.achEnabled) toast.success("Bank payments are on. Clients can now pay by bank transfer (ACH).");
        else toast.message("Bank payments aren't on yet. Stripe can take a few minutes after you turn on ACH Direct Debit.");
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void loadStatus();
    const stripe = searchParams.get("stripe");
    if (stripe === "connected") toast.success("Stripe connected");
    if (stripe === "pending") toast.message("Stripe onboarding saved — finish any remaining requirements to accept payments.");
    if (stripe === "error") toast.error("Stripe connection failed");
    if (stripe === "platform") toast.message("This business uses the platform Stripe account.");
  }, [searchParams]);

  // Re-fetch live status whenever returning to this card (e.g. Stripe → onboarding).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadStatus();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  async function startOnboarding() {
    setStarting(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error || "Could not start Stripe onboarding.");
        setStarting(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start Stripe onboarding.");
      setStarting(false);
    }
  }

  const ready = !loading || state !== null;
  const canTakePayments = Boolean(state && (state.isPlatform || state.status === "active"));
  const pill = state ? statusPill(state) : null;
  const connectLabel = !state?.hasAccount || state.status === "not_connected" ? "Connect Stripe" : "Finish setup";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-[22px] font-extrabold text-white"
              aria-hidden
            >
              S
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-base font-bold text-heading">
                Stripe
                {pill ? (
                  <Pill tone={pill.tone}>
                    {pill.tone === "good" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    {pill.label}
                  </Pill>
                ) : null}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Clients pay you directly. ShootPortal takes 0%. Payouts, refunds and tax forms live in your Stripe Dashboard.
              </p>
              {state && !state.isPlatform && state.hasAccount && state.status !== "active" ? (
                <p className="mt-1 text-[13px] text-muted">
                  Charges {state.chargesEnabled ? "on" : "off"} · Payouts {state.payoutsEnabled ? "on" : "off"}. Finish
                  Stripe&apos;s steps to accept payments.
                </p>
              ) : null}
              {state?.isPlatform ? (
                <p className="mt-1 text-[13px] text-muted">This business uses the platform Stripe account. Payments settle there.</p>
              ) : null}
            </div>
          </div>
          <div className="sm:ml-auto sm:shrink-0">
            {!ready || !state ? (
              <span className="inline-flex min-h-11 items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </span>
            ) : canTakePayments ? (
              state.dashboardUrl ? (
                <a href={state.dashboardUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" tabIndex={-1}>
                    <ExternalLink className="h-4 w-4" /> Stripe Dashboard
                  </Button>
                </a>
              ) : null
            ) : (
              <Button variant="accent" className="min-h-11 w-full sm:w-auto" disabled={starting} onClick={startOnboarding}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {starting ? "Redirecting…" : connectLabel}
              </Button>
            )}
          </div>
        </div>
        <details className="group mt-3 sm:pl-16">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent hover:underline">
            About receipts
          </summary>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            ShootPortal emails a payment receipt from your business sender. Stripe also sends one when &ldquo;Successful
            payments&rdquo; is on under Stripe Dashboard → Settings → Customer emails. Turn that off so clients get a single
            receipt from you.
          </p>
        </details>
      </div>

      {state ? (
        <WaysToPay state={state} canTakePayments={canTakePayments} checking={checking} onCheck={checkBankPayments} />
      ) : null}
    </div>
  );
}

/**
 * Card is always on. Bank (ACH): on Standard Stripe accounts only the account owner can turn on
 * ACH Direct Debit, in their own Stripe Dashboard; ShootPortal then offers it automatically.
 */
function WaysToPay({
  state,
  canTakePayments,
  checking,
  onCheck,
}: {
  state: ConnectState;
  canTakePayments: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  const achOn = Boolean(state.achEnabled);
  const [showSteps, setShowSteps] = useState(false);

  // Deep links to #settings-bank-payments open the setup steps.
  useEffect(() => {
    const sync = () => {
      if (window.location.hash.endsWith("#settings-bank-payments")) setShowSteps(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("portal:hash-target", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("portal:hash-target", sync);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-heading">Ways clients can pay</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent" aria-hidden>
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-heading">Card</p>
            <p className="text-[13px] text-muted">Credit and debit cards</p>
          </div>
          {canTakePayments ? <Pill tone="good">Always on</Pill> : <Pill tone="neutral">Needs Stripe</Pill>}
        </div>

        <div id="settings-bank-payments" className="scroll-mt-24 rounded-xl border border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent" aria-hidden>
              <Landmark className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-heading">Bank transfer (ACH)</p>
              <p className="text-[13px] text-muted">Settles in a few business days</p>
            </div>
            {!canTakePayments ? (
              <Pill tone="neutral">Needs Stripe</Pill>
            ) : achOn ? (
              <Pill tone="good">
                <Check className="h-3.5 w-3.5" aria-hidden /> On
              </Pill>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                aria-expanded={showSteps}
                aria-controls="settings-bank-payments-steps"
                onClick={() => setShowSteps((v) => !v)}
              >
                Turn on
              </Button>
            )}
          </div>
          {canTakePayments && !achOn && showSteps ? (
            <div id="settings-bank-payments-steps" className="mt-3 border-t border-border pt-3">
              <p className="text-[13px] text-muted">
                Bank payments are deposited to the same bank account as your card payouts. Turn them on in Stripe:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-foreground">
                <li>Open your Stripe payment method settings.</li>
                <li>
                  Turn on <span className="font-medium">ACH Direct Debit</span>. Stripe may ask a few questions.
                </li>
                <li>Come back and click Check again.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.achSettingsUrl ? (
                  <a href={state.achSettingsUrl} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="accent" size="sm" className="min-h-10">
                      <ExternalLink className="h-4 w-4" /> Open Stripe settings
                    </Button>
                  </a>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="min-h-10" disabled={checking} onClick={onCheck}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {checking ? "Checking…" : "Check again"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
