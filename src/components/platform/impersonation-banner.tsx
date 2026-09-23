"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSubscriptionState } from "@/lib/subscription";
import {
  IMPERSONATION_READONLY_EVENT,
  IMPERSONATION_READONLY_MESSAGE,
  isImpersonationReadonlyPayload,
  notifyImpersonationReadonlyBlocked,
  type ImpersonationReadonlyBlockedDetail,
} from "@/lib/impersonation-readonly";

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
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const sub =
    subscriptionStatus != null
      ? getSubscriptionState({
          subscription_status: subscriptionStatus,
          trial_ends_at: trialEndsAt ?? null,
          comped_until: compedUntil ?? null,
          comped_reason: compedReason ?? null,
        })
      : null;

  useEffect(() => {
    if (allowWrites) {
      setBlockedNotice(null);
      return;
    }
    const onBlocked = (event: Event) => {
      const detail = (event as CustomEvent<ImpersonationReadonlyBlockedDetail>).detail;
      setBlockedNotice(detail?.message || IMPERSONATION_READONLY_MESSAGE);
    };
    window.addEventListener(IMPERSONATION_READONLY_EVENT, onBlocked);

    // Catch any read-only 403 (not just the thumb client) and surface it on this banner.
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      if (res.status === 403) {
        const endpoint =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
              ? args[0].url
              : String(args[0] ?? "");
        void res
          .clone()
          .json()
          .then((data: unknown) => {
            if (!isImpersonationReadonlyPayload(data)) return;
            const message =
              typeof data.error === "string" && data.error
                ? data.error
                : IMPERSONATION_READONLY_MESSAGE;
            notifyImpersonationReadonlyBlocked({
              message,
              endpoint,
              status: res.status,
            });
          })
          .catch(() => {
            /* non-JSON 403 — ignore */
          });
      }
      return res;
    };

    return () => {
      window.removeEventListener(IMPERSONATION_READONLY_EVENT, onBlocked);
      window.fetch = originalFetch;
    };
  }, [allowWrites]);

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
          {!allowWrites && blockedNotice ? (
            <p className="mt-1 font-medium text-red-950" role="status">
              Blocked while read-only: {blockedNotice}
            </p>
          ) : null}
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
            Exit impersonation
          </Button>
          <form action="/api/auth/signout" method="POST">
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="border-red-800 bg-transparent text-red-950 hover:bg-red-100"
              disabled={busy}
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
