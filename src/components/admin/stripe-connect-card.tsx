"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Link2, Loader2 } from "lucide-react";
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

  useEffect(() => {
    loadStatus();
    const stripe = searchParams.get("stripe");
    if (stripe === "connected") toast.success("Stripe connected");
    if (stripe === "pending") toast.message("Stripe onboarding saved — finish any remaining requirements to accept payments.");
    if (stripe === "error") toast.error("Stripe connection failed");
    if (stripe === "platform") toast.message("This business uses the platform Stripe account.");
  }, [searchParams]);

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
          Clients pay you directly. You keep your own Stripe Dashboard for payouts, refunds, and tax forms.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !state ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : state.isPlatform ? (
          <p className="text-sm text-muted">
            Swift Aerial Media uses the platform Stripe account. Payments continue to settle here — no connected-account
            onboarding.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Status: <span className="font-medium text-primary">{statusLabel(state.status)}</span>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
