"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, ExternalLink, Landmark, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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

function statusLabel(status: ConnectStatus): string {
  switch (status) {
    case "active":
      return "Connected";
    case "pending":
      return "Onboarding in progress";
    case "restricted":
      return "Restricted — finish Stripe requirements";
    case "disabled":
      return "Disabled";
    default:
      return "Not connected";
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
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start Stripe onboarding.");
      setStarting(false);
    }
  }

  const connectLabel =
    state?.status === "not_connected" || !state?.hasAccount
      ? "Connect Stripe"
      : state.status === "active"
        ? "Manage on Stripe"
        : "Continue setup";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-accent" />
          Stripe
        </CardTitle>
        <p className="text-sm text-muted">
          Clients pay you directly through Stripe. ShootPortal takes 0% of client payments —
          Stripe&apos;s processing fees apply (estimates for US domestic cards; international and
          other card types may differ). You keep your own Stripe Dashboard for payouts, refunds,
          and tax forms. ShootPortal emails a payment receipt from your business sender.
          Stripe also emails one when “Successful payments” is on under Stripe Dashboard →
          Settings → Customer emails. That switch is per Stripe account, so turn it off if
          clients should get a single receipt from you. ShootPortal does not set a Stripe
          receipt email address, so Stripe stays quiet unless that switch is on.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !state ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : state.isPlatform ? (
          <>
            <p className="text-sm text-muted">
              This business uses the platform Stripe account. Payments continue to settle here — no connected-account
              onboarding.
            </p>
            <BankPaymentsPanel state={state} checking={checking} onCheck={checkBankPayments} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Status: <span className="font-medium text-heading">{statusLabel(state.status)}</span>
            </p>
            <p className="text-sm text-muted">
              Charges {state.chargesEnabled ? "enabled" : "disabled"}
              {" · "}
              Payouts {state.payoutsEnabled ? "enabled" : "disabled"}
            </p>
            {state.status === "active" ? (
              <a href={state.dashboardUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" /> Manage on Stripe
                </Button>
              </a>
            ) : (
              <Button variant="accent" size="sm" disabled={starting} onClick={startOnboarding}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {starting ? "Redirecting…" : connectLabel}
              </Button>
            )}
            {state.status === "active" ? <BankPaymentsPanel state={state} checking={checking} onCheck={checkBankPayments} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Bank (ACH) payments. On Standard Stripe accounts only the account owner can turn on
 * ACH Direct Debit, in their own Stripe Dashboard; ShootPortal then offers it to clients
 * automatically. Bank payments are paid out to the same bank account as card payments.
 */
function BankPaymentsPanel({ state, checking, onCheck }: { state: ConnectState; checking: boolean; onCheck: () => void }) {
  const on = Boolean(state.achEnabled);
  return (
    <div id="settings-bank-payments" className="scroll-mt-24 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading">
            Bank transfers (ACH)
            {on ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 surface-dark:bg-emerald-950/40 surface-dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> On
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted surface-dark:bg-subtle">Off</span>
            )}
          </p>
          {on ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Clients can choose <span className="font-medium text-heading">Bank account</span> when they pay. They connect their bank securely through
              Stripe, the payment shows as processing for a few business days, and it&apos;s deposited to the same bank account as your card payouts.
              Stripe charges 0.8% per bank payment (max $5).
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Let clients pay straight from their bank account. Stripe charges 0.8% (max $5) instead of about 3% for cards, and the money is
                deposited to the same bank account as your card payouts.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-heading">
                <li>Open your Stripe payment method settings.</li>
                <li>
                  Find <span className="font-medium">ACH Direct Debit</span> and turn it on. Stripe may ask a few questions first.
                </li>
                <li>Come back here and click Check again.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.achSettingsUrl ? (
                  <a href={state.achSettingsUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="accent" size="sm">
                      <ExternalLink className="h-4 w-4" /> Open Stripe settings
                    </Button>
                  </a>
                ) : null}
                <Button variant="outline" size="sm" disabled={checking} onClick={onCheck}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {checking ? "Checking…" : "Check again"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
