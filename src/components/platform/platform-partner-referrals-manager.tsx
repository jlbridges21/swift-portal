"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  PlatformReferralRow,
  ReferralRemovalPreview,
  ReferralRemovalRow,
} from "@/lib/partner-referral-admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    trialing: "Trialing",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    trial_expired: "Trial expired",
    deleted: "Deleted",
  };
  return map[status] || status;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    link: "Referral link",
    landing_page: "Landing page",
    promo_code: "Promo code",
    manual: "Added by admin",
  };
  return map[source] || source;
}

function planLabel(r: PlatformReferralRow): string {
  if (r.interval === "annual") return `${r.plan} · annual`;
  if (r.interval === "monthly") return `${r.plan} · monthly`;
  return r.plan;
}

function priceChangeSentence(preview: ReferralRemovalPreview): string {
  const s = preview.stripe;
  switch (s.kind) {
    case "no_subscription":
      return "They haven’t subscribed yet, so nothing changes in Stripe. When they subscribe they’ll pay the standard price.";
    case "no_referral_discount":
      return "Their subscription has no referral discount right now, so their price doesn’t change.";
    case "discount_active":
      return s.effectiveAt
        ? `The referral discount comes off their subscription now. What they’ve already paid stays the same. Their next bill, on ${formatDate(s.effectiveAt)}, will be at the standard price. No refund and no extra charge.`
        : "The referral discount comes off their subscription now. Their next bill will be at the standard price. No refund and no extra charge.";
    case "error":
      return `Couldn’t check Stripe (${s.message}). The referral will still be removed, and you can retry the Stripe step from the history below.`;
  }
}

export function PlatformPartnerReferralsManager({
  partnerId,
  partnerName,
  commissionEligible,
  rows,
  removals,
}: {
  partnerId: string;
  partnerName: string;
  commissionEligible: boolean;
  rows: PlatformReferralRow[];
  removals: ReferralRemovalRow[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<PlatformReferralRow | null>(null);
  const [preview, setPreview] = useState<ReferralRemovalPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function openRemove(row: PlatformReferralRow) {
    setTarget(row);
    setPreview(null);
    setReason("");
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/referrals/${row.businessId}`);
      const data = (await res.json()) as { preview?: ReferralRemovalPreview; error?: string };
      if (!res.ok || !data.preview) throw new Error(data.error || "Could not load details.");
      setPreview(data.preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load details.");
      setTarget(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function confirmRemove() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/referrals/${target.businessId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, reason: reason.trim() || null }),
      });
      const data = (await res.json()) as {
        result?: { status: string; stripe: { status: string; detail: string } };
        error?: string;
      };
      if (!res.ok || !data.result) throw new Error(data.error || "Could not remove referral.");
      if (data.result.stripe.status === "failed") {
        toast.warning(
          `Referral removed, but Stripe wasn’t updated: ${data.result.stripe.detail} Use “Retry Stripe” in the history below.`
        );
      } else {
        toast.success(`${target.businessName} is no longer referred by ${partnerName}.`);
      }
      setTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove referral.");
    } finally {
      setBusy(false);
    }
  }

  async function retryStripe(removal: ReferralRemovalRow) {
    if (!removal.businessId) return;
    setRetrying(removal.id);
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/referrals/${removal.businessId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await res.json()) as {
        result?: { stripe: { status: string; detail: string } };
        error?: string;
      };
      if (!res.ok || !data.result) throw new Error(data.error || "Retry failed.");
      if (data.result.stripe.status === "failed") toast.error(data.result.stripe.detail);
      else toast.success("Stripe is up to date.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">This partner has no referred businesses right now.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.businessId} className="rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/platform/businesses/${r.businessId}`}
                    className="font-semibold text-heading hover:underline"
                  >
                    {r.businessName}
                  </Link>
                  <p className="mt-0.5 break-all font-mono text-xs text-muted">{r.businessId}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 text-red-700"
                  onClick={() => void openRemove(r)}
                >
                  Remove referral
                </Button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Signed up</dt>
                  <dd>{r.signedUpAt ? formatDate(r.signedUpAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Referred</dt>
                  <dd>
                    {formatDate(r.attributedAt)} · {sourceLabel(r.source)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Subscription</dt>
                  <dd>{statusLabel(r.subscriptionStatus)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Plan</dt>
                  <dd>{planLabel(r)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Referral discount</dt>
                  <dd className="text-xs">{r.discountLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Revenue paid</dt>
                  <dd>{formatCurrency(r.revenueCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Commission earned</dt>
                  <dd>
                    {formatCurrency(r.commissionEarnedCents)}
                    {!commissionEligible && r.commissionEarnedCents === 0 ? (
                      <span className="text-xs text-muted"> (commissions off)</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Paid / unpaid</dt>
                  <dd>
                    {formatCurrency(r.commissionPaidCents)} / {formatCurrency(r.commissionUnpaidCents)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {removals.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Removed referrals</h3>
          {removals.map((m) => (
            <div key={m.id} className="rounded-lg border border-dashed border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-heading">{m.businessName ?? "Deleted business"}</p>
                <Badge variant={m.stripeDiscountStatus === "failed" ? "danger" : "default"}>
                  {m.stripeDiscountStatus === "removed"
                    ? "Discount removed in Stripe"
                    : m.stripeDiscountStatus === "none"
                      ? "No Stripe change needed"
                      : m.stripeDiscountStatus === "failed"
                        ? "Stripe update failed"
                        : "Stripe update pending"}
                </Badge>
              </div>
              <p className="mt-1 text-muted">
                Removed {formatDate(m.removedAt)}
                {m.removedByEmail ? ` by ${m.removedByEmail}` : ""} · originally referred{" "}
                {formatDate(m.attributedAt)} ({sourceLabel(m.source)})
              </p>
              {m.reason ? <p className="mt-1">Reason: {m.reason}</p> : null}
              <p className="mt-1 text-xs text-muted">
                Unpaid commissions voided: {m.voidedCommissionCount} ({formatCurrency(m.voidedCommissionCents)}) · Paid
                commissions kept: {formatCurrency(m.paidCommissionCents)}
                {m.stripeDiscountEffectiveAt
                  ? ` · Standard price from ${formatDate(m.stripeDiscountEffectiveAt)}`
                  : ""}
              </p>
              {(m.stripeDiscountStatus === "failed" || m.stripeDiscountStatus === "pending") && m.businessId ? (
                <div className="mt-2">
                  {m.stripeDiscountDetail ? (
                    <p className="mb-2 text-xs text-red-700">{m.stripeDiscountDetail}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retrying === m.id}
                    onClick={() => void retryStripe(m)}
                  >
                    {retrying === m.id ? "Retrying…" : "Retry Stripe"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={target != null}
        onClose={() => (busy ? undefined : setTarget(null))}
        title="Remove Referral Attribution?"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || loadingPreview || !preview}
              onClick={() => void confirmRemove()}
            >
              {busy ? "Removing…" : "Remove referral"}
            </Button>
          </div>
        }
      >
        {target ? (
          <div className="space-y-4 text-sm">
            <p>
              This will remove <strong>{target.businessName}</strong> from <strong>{partnerName}</strong>’s
              referrals. Future partner commissions and referral discounts will no longer apply. This will
              not delete the business or its ShootPortal account.
            </p>
            {loadingPreview || !preview ? (
              <p className="text-muted">Checking billing and commissions…</p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5">
                <li>{priceChangeSentence(preview)}</li>
                <li>
                  {preview.unpaidCommissionCents > 0
                    ? `${formatCurrency(preview.unpaidCommissionCents)} in unpaid commission will be voided. The original records are kept for your history.`
                    : "There are no unpaid commissions to void."}
                </li>
                {preview.paidCommissionCents > 0 ? (
                  <li>
                    {formatCurrency(preview.paidCommissionCents)} already paid to the partner stays as is. Nothing
                    is clawed back.
                  </li>
                ) : null}
                <li>Their users, projects, clients, and media aren’t touched.</li>
              </ul>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="remove-referral-reason">Reason (optional)</Label>
              <Textarea
                id="remove-referral-reason"
                rows={2}
                maxLength={500}
                placeholder="e.g. Account created during a live demo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
