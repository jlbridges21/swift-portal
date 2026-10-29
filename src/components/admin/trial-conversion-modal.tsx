"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatUsd, isCalmAdminPath, type TrialMilestone, type TrialModalCopy } from "@/lib/trial-conversion";
import { cn } from "@/lib/utils";

/** One trial modal per browser session, across tabs of the same session storage. */
const SESSION_KEY = "sp_trial_modal_session";
const OPEN_DELAY_MS = 1500;

type Props = {
  milestone: TrialMilestone;
  trialDay: number;
  copy: TrialModalCopy;
  planKey: string;
  monthlyCents: number | null;
  annualPerMonthCents: number | null;
  /** "November 15" — the stored trial end. */
  trialEndLabel: string;
  canCheckout: boolean;
};

function post(milestone: TrialMilestone, action: "viewed" | "dismissed" | "cta", trialDay: number) {
  return fetch("/api/billing/trial-modal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ milestone, action, trialDay }),
    keepalive: true,
  }).catch(() => undefined);
}

export function TrialConversionModal({
  milestone,
  trialDay,
  copy,
  planKey,
  monthlyCents,
  annualPerMonthCents,
  trialEndLabel,
  canCheckout,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Open only on calm pages, once per session, never over another dialog.
  useEffect(() => {
    if (open || done || !isCalmAdminPath(pathname)) return;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;
    const t = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* storage blocked — server state still limits it to once per milestone */
      }
      previousFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
      void post(milestone, "viewed", trialDay);
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname, open, done, milestone, trialDay]);

  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open]);

  const close = useCallback(
    (action: "dismissed" | "cta") => {
      setOpen(false);
      setDone(true);
      void post(milestone, action, trialDay);
      previousFocus.current?.focus?.();
    },
    [milestone, trialDay]
  );

  const onDismiss = useCallback(() => close("dismissed"), [close]);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    void post(milestone, "cta", trialDay);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, interval, context: `modal_${milestone}` }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; code?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.code === "already_subscribed") {
        close("cta");
        router.refresh();
        return;
      }
      setError(data.error?.trim() || "Could not open checkout. You can also choose a plan from Billing.");
    } catch {
      setError("Could not open checkout. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const annualTotal = annualPerMonthCents != null ? annualPerMonthCents * 12 : null;
  const plans = [
    {
      key: "monthly" as const,
      title: "Monthly",
      price: `${formatUsd(monthlyCents)}/month`,
      note: "Billed monthly",
    },
    ...(annualTotal != null
      ? [
          {
            key: "annual" as const,
            title: "Annual",
            price: `${formatUsd(annualTotal)}/year`,
            note: `${formatUsd(annualPerMonthCents)}/month · Best Value`,
          },
        ]
      : []),
  ];
  const showPlans = copy.showPlans && canCheckout;

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title={copy.headline}
      className="sm:max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              if (copy.secondaryOpensPlans) {
                close("cta");
                router.push("/billing");
              } else {
                onDismiss();
              }
            }}
          >
            {copy.secondary}
          </Button>
          <Button
            ref={primaryRef}
            type="button"
            variant="accent"
            className="min-h-11"
            disabled={busy}
            onClick={() => {
              if (showPlans) {
                void startCheckout();
              } else if (copy.showPlans) {
                close("cta");
                router.push("/billing");
              } else {
                close("cta");
              }
            }}
          >
            {busy ? "Opening secure checkout…" : copy.primary}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{copy.body}</p>
      {showPlans ? (
        <fieldset className="mt-4">
          <legend className="sr-only">Choose a plan</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <label
                key={p.key}
                className={cn(
                  "flex cursor-pointer flex-col rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent",
                  interval === p.key ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="trial-modal-plan"
                  value={p.key}
                  checked={interval === p.key}
                  onChange={() => setInterval(p.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-heading">{p.title}</span>
                <span className="text-lg font-bold text-heading">{p.price}</span>
                <span className="text-xs text-muted">{p.note}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            You won&apos;t be charged until your free trial ends on {trialEndLabel}.
          </p>
        </fieldset>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
