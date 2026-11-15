"use client";

import { useState, type ReactNode } from "react";
import { Lock, ReceiptText, Share2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AcceptSetupDefaultButton } from "@/components/admin/accept-setup-default-button";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

function CheckoutRow({
  id,
  toggleId,
  icon,
  title,
  description,
  checked,
  onChange,
  extra,
}: {
  id: string;
  toggleId: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  extra?: ReactNode;
}) {
  return (
    <div id={id} tabIndex={-1} className="scroll-mt-24 py-4 outline-none first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-muted" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={toggleId} className="block cursor-pointer text-sm font-semibold text-heading">
            {title}
          </label>
          <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</div>
        </div>
        <span className="flex min-h-11 items-center">
          <Switch id={toggleId} aria-label={title} checked={checked} onCheckedChange={onChange} />
        </span>
      </div>
      {extra}
    </div>
  );
}

export function PaymentsTab() {
  const { settings, setSettings, patchPayments, patchVideoSharing, payments, attention } = useSettingsTab();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div id="settings-payments" tabIndex={-1} className="scroll-mt-24 space-y-4">
      <SectionHeading id="payments">Payments</SectionHeading>
      <p className="mt-1 mb-4 text-sm text-muted">How clients pay you.</p>

      {payments}

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-heading">Checkout &amp; delivery</h3>
        <div className="divide-y divide-border">
          <CheckoutRow
            id="settings-card-fee"
            toggleId="passCardFeeToClient"
            icon={<ReceiptText className="h-4 w-4" />}
            title="Clients cover the card processing fee"
            checked={settings.workflow.payments.passCardFeeToClient}
            onChange={(v) =>
              setSettings((prev) => ({
                ...prev,
                workflow: { ...prev.workflow, payments: { ...prev.workflow.payments, passCardFeeToClient: v } },
              }))
            }
            description={
              <>
                Adds a &ldquo;Card processing fee&rdquo; line at card checkout. Bank payments never include it.{" "}
                <button
                  type="button"
                  className="font-semibold text-accent hover:underline"
                  aria-expanded={rulesOpen}
                  aria-controls="settings-card-fee-rules"
                  onClick={() => setRulesOpen((v) => !v)}
                >
                  Check surcharge rules
                </button>
              </>
            }
            extra={
              rulesOpen ? (
                <p
                  id="settings-card-fee-rules"
                  className="mt-3 rounded-xl bg-subtle px-4 py-3 text-[13px] leading-relaxed text-muted sm:ml-[52px]"
                >
                  You keep the full invoice amount. Clients see the fee before they pay and can avoid it by paying by bank.
                  Card networks don&apos;t allow surcharges on debit cards and some states restrict them, so check what
                  applies to your business before turning this on.
                </p>
              ) : null
            }
          />
          <CheckoutRow
            id="settings-download-gate"
            toggleId="requireDeliveredForDownloads"
            icon={<Lock className="h-4 w-4" />}
            title="Unlock downloads after delivery"
            checked={settings.payments.requireDeliveredForDownloads}
            onChange={(v) => patchPayments({ requireDeliveredForDownloads: v })}
            description="Full-resolution downloads open once a project is Delivered. Off: clients can download anytime, even before paying."
          />
          <CheckoutRow
            id="settings-video-sharing"
            toggleId="allowClientPublicVideoSharing"
            icon={<Share2 className="h-4 w-4" />}
            title="Let clients share delivered videos"
            checked={settings.videoSharing.allowClientPublicSharing}
            onChange={(v) => patchVideoSharing({ allowClientPublicSharing: v })}
            description="Public link and embed code for one video at a time. Turning this off also stops links clients already shared."
          />
        </div>
      </div>

      {!attention.includes("payments") ? null : !settings.setupAcceptedDefaults?.stripe ? (
        <AcceptSetupDefaultButton acceptKey="stripe" />
      ) : (
        <p className="text-xs text-muted">
          You chose to connect payments later. Client invoices stay unavailable until Stripe is connected.
        </p>
      )}
    </div>
  );
}
