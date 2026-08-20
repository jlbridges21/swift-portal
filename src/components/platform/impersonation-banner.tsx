"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSubscriptionState } from "@/lib/subscription";

export function ImpersonationBanner({
  businessName,
  businessId,
  allowWrites,
  subscriptionStatus,
  trialEndsAt,
  compedUntil,
  compedReason,
}: {
  businessName: string;
  businessId: string;
  allowWrites: boolean;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  compedUntil?: string | null;
  compedReason?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const sub =
    subscriptionStatus != null
      ? getSubscriptionState({
          subscription_status: subscriptionStatus,
          trial_ends_at: trialEndsAt ?? null,
          comped_until: compedUntil ?? null,
          comped_reason: compedReason ?? null,
        })
      : null;

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.refresh();
      if (body.action === "exit") router.push("/platform");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-400 bg-amber-400 px-4 py-2.5 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold">
            Viewing as {businessName}
            <span className="ml-2 font-normal">
              {allowWrites ? "Writes are enabled for this session." : "Read-only impersonation."}
            </span>
          </p>
          {sub && (
            <p className="mt-0.5 font-normal">
              Subscription: <strong>{sub.status}</strong>
              {sub.isComped
                ? sub.reason
                  ? ` — complimentary (${sub.reason}).`
                  : " — complimentary access."
                : sub.requiresPayment
                  ? " — paywalled for this business’s admins (you retain access)."
                  : sub.status === "trialing" && sub.daysLeftInTrial != null
                    ? ` — ${sub.daysLeftInTrial} day${sub.daysLeftInTrial === 1 ? "" : "s"} left in trial.`
                    : sub.status === "past_due"
                      ? " — payment past due (access continues)."
                      : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!allowWrites && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-900 bg-white text-slate-900"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Allow writes while viewing ${businessName}? This is audit-logged and expires with the impersonation session.`
                  )
                ) {
                  void post({ action: "allow_writes", businessId });
                }
              }}
            >
              Allow writes
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="bg-slate-950 text-white hover:bg-slate-800"
            disabled={busy}
            onClick={() => void post({ action: "exit" })}
          >
            Exit to platform
          </Button>
        </div>
      </div>
    </div>
  );
}
