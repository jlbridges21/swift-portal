"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * Super admin only. Off = the partner stays in the program (dashboard, links, landing page,
 * promo code, customer discount) but earns no commissions and receives no payouts.
 */
export function PartnerCommissionEligibilityCard({
  partnerId,
  eligible,
  note,
  updatedAt,
  migrationPending,
}: {
  partnerId: string;
  eligible: boolean;
  note: string | null;
  updatedAt: string | null;
  migrationPending: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pending == null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/commission-eligibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eligible: pending, note: reason.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      toast.success(pending ? "Commissions turned on." : "Commissions turned off.");
      setPending(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-heading">Earns commissions</h3>
            <p className="mt-1 text-sm text-muted">
              {eligible
                ? "This partner earns commission on payments from businesses they refer."
                : "Turned off. This partner stays in the program (dashboard, referral link, landing page, promo code) but earns no commissions and is never paid out."}
            </p>
            {note ? <p className="mt-1 text-sm">Reason: {note}</p> : null}
            {updatedAt ? <p className="mt-1 text-xs text-muted">Last changed {formatDate(updatedAt)}</p> : null}
            {migrationPending ? (
              <p className="mt-1 text-xs text-amber-700">Needs database migration v108 before this can be changed.</p>
            ) : null}
          </div>
          <Switch
            checked={eligible}
            disabled={migrationPending}
            aria-label="Earns commissions"
            onCheckedChange={(next) => {
              setReason("");
              setPending(next);
            }}
          />
        </div>
      </CardContent>

      <Modal
        open={pending != null}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending ? "Turn commissions on?" : "Turn commissions off?"}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={pending ? "default" : "destructive"}
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : pending ? "Turn on" : "Turn off"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            {pending
              ? "Starting now, payments from this partner’s referred businesses will earn commission. Payments made while commissions were off are not added back."
              : "Starting now, no new commissions will be earned and payouts to this partner are blocked. Any existing commission records are kept as they are for you to review."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="commission-eligibility-reason">Reason (optional)</Label>
            <Textarea
              id="commission-eligibility-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
