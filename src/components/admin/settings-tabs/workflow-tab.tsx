"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowSettingsCard } from "@/components/admin/workflow-settings-card";
import { CompactToggle, SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { preliminaryEstimateDisclaimer } from "@/lib/preliminary-disclaimer";

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-heading">{label}</span>
        {hint ? <span className="mt-0.5 block text-[13px] text-muted">{hint}</span> : null}
      </span>
      <CompactToggle id={id} checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

function DaysRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <label htmlFor={id} className="text-sm font-semibold text-heading">
        {label}
      </label>
      <span className="flex items-center gap-2 text-sm text-muted">
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-11 w-20 text-center"
        />
        days
      </span>
    </div>
  );
}

export function WorkflowTab() {
  const { settings, patchProposals, patchWorkflow } = useSettingsTab();
  const [editingDisclaimer, setEditingDisclaimer] = useState(false);
  const proposals = settings.proposals;
  const disclaimerPreview = preliminaryEstimateDisclaimer(
    settings.business.businessName || "your business",
    proposals.preliminaryDisclaimer
  ).trim();

  return (
    <div id="settings-workflow" tabIndex={-1} className="scroll-mt-24 space-y-5">
      <div>
        <SectionHeading id="workflow">Workflow Automation</SectionHeading>
        <p className="mt-1 text-sm text-muted">What ShootPortal does for you at each stage.</p>
      </div>

      <WorkflowSettingsCard workflow={settings.workflow} onChange={patchWorkflow} />

      <section
        id="settings-workflow-proposal-settings"
        aria-labelledby="proposal-settings-title"
        className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 id="proposal-settings-title" className="text-base font-semibold text-heading">
            Proposal settings
          </h3>
          <p className="text-[13px] text-muted">For new projects and proposals going forward</p>
        </div>

        <div className="mt-2 divide-y divide-border">
          <ToggleRow
            id="requireAdminReview"
            label="Review official proposals before they're sent"
            hint="You approve each one first."
            checked={proposals.requireAdminReviewBeforeOfficial}
            onChange={(v) => patchProposals({ requireAdminReviewBeforeOfficial: v })}
          />
          <ToggleRow
            id="showPreliminary"
            label="Show the preliminary estimate to clients"
            checked={proposals.showPreliminaryToClients}
            onChange={(v) => patchProposals({ showPreliminaryToClients: v })}
          />
          <ToggleRow
            id="allowChanges"
            label="Let clients request proposal changes"
            checked={proposals.allowClientProposalChanges}
            onChange={(v) => patchProposals({ allowClientProposalChanges: v })}
          />
          <DaysRow
            id="estimateExpiration"
            label="Estimates expire after"
            value={proposals.defaultEstimateExpirationDays}
            onChange={(n) => patchProposals({ defaultEstimateExpirationDays: n })}
          />
          <DaysRow
            id="proposalExpiration"
            label="Proposals expire after"
            value={proposals.defaultProposalExpirationDays}
            onChange={(n) => patchProposals({ defaultProposalExpirationDays: n })}
          />
          <div className="py-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <label htmlFor="preliminaryDisclaimer" className="text-sm font-semibold text-heading">
                  Estimate disclaimer
                </label>
                {!editingDisclaimer ? (
                  <p className="mt-1 line-clamp-3 text-[13px] italic text-muted">
                    {disclaimerPreview ? `“${disclaimerPreview}”` : "No disclaimer."}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 sm:h-9"
                aria-expanded={editingDisclaimer}
                aria-controls="preliminaryDisclaimer"
                onClick={() => setEditingDisclaimer((v) => !v)}
              >
                {editingDisclaimer ? <Check className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
                {editingDisclaimer ? "Done" : "Edit"}
              </Button>
            </div>
            {editingDisclaimer ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  id="preliminaryDisclaimer"
                  rows={4}
                  autoFocus
                  value={proposals.preliminaryDisclaimer}
                  onChange={(e) => patchProposals({ preliminaryDisclaimer: e.target.value })}
                />
                <p className="text-xs text-muted">
                  Use {"{{businessName}}"}. It&apos;s replaced with your business name when shown.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
