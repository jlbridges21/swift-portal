"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, ListPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EstimatePdfPreview } from "@/components/projects/estimate-pdf-preview";
import type { EstimatePdfInput } from "@/lib/estimate-pdf";
import { SECTION_HEADING_PREFIX } from "@/lib/estimate-sections";
import type { QuoteLineItem } from "@/lib/types";
import type { DepositMode } from "@/lib/workflow-settings";
import { formatCurrency } from "@/lib/utils";

export type EstimateFormState = {
  title: string;
  description: string;
  notes: string;
  expires_at: string;
  line_items: QuoteLineItem[];
  deposit_mode: DepositMode;
  deposit_percent: number;
  deposit_amount_cents: number;
};

/** Integer-cent total of the editor's line items (the server recomputes the same sum). */
export function estimateFormTotalCents(items: QuoteLineItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(Number(item.amount_cents) || 0), 0);
}

/**
 * The one estimate editor. Preliminary estimates and official proposals both
 * render this: editable details on the left, the live PDF preview on the right
 * (same builder as the generated PDF, debounced inside EstimatePdfPreview).
 * Callers own saving: `actions` decides what Save does, so a preliminary
 * estimate stays preliminary and an official proposal keeps its send flow.
 */
export function EstimateEditor({
  heading,
  badge,
  intro,
  form,
  setForm,
  extraFields,
  paymentTerms,
  previewInput,
  logoUrl,
  actions,
  titlePlaceholder = "Aerial Media Package",
}: {
  heading: string;
  badge?: ReactNode;
  /** One line under the heading (what saving does). */
  intro?: ReactNode;
  form: EstimateFormState;
  setForm: (update: (current: EstimateFormState) => EstimateFormState) => void;
  /** Rendered between deliverables and line items (manual travel miles). */
  extraFields?: ReactNode;
  paymentTerms: string | null;
  previewInput: EstimatePdfInput;
  logoUrl: string;
  actions: ReactNode;
  titlePlaceholder?: string;
}) {
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const uid = useId();
  const totalCents = estimateFormTotalCents(form.line_items);

  function updateLineItem(index: number, patch: Partial<QuoteLineItem>) {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addServiceSection() {
    setForm((f) => {
      const base = f.description.trimEnd();
      return { ...f, description: `${base}${base ? "\n\n" : ""}${SECTION_HEADING_PREFIX}Service name\n• Deliverable` };
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)] lg:items-start">
      <div className="min-w-0 space-y-5 rounded-2xl bg-slate-50/60 p-4 ring-1 ring-black/[0.04] surface-dark:bg-subtle/60 sm:p-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-heading">{heading}</p>
            {badge}
          </div>
          {intro ? <p className="text-xs leading-relaxed text-muted">{intro}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${uid}-title`}>Title</Label>
          <Input
            id={`${uid}-title`}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={titlePlaceholder}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor={`${uid}-description`}>Description &amp; included deliverables</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addServiceSection}>
              <ListPlus className="h-3.5 w-3.5" /> Add service section
            </Button>
          </div>
          <Textarea
            id={`${uid}-description`}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={10}
            aria-describedby={`${uid}-description-help`}
            placeholder={"Optional intro paragraph\n\nIncludes\n• Deliverable one\n• Deliverable two"}
            className="font-[inherit] leading-relaxed"
          />
          <p id={`${uid}-description-help`} className="text-xs leading-relaxed text-muted">
            Start a line with <code className="rounded bg-white px-1 surface-dark:bg-card">## </code> to begin a service
            heading; lines starting with • are listed as deliverables under it.
          </p>
        </div>

        {extraFields}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-heading">Line items</legend>
          <ul className="space-y-2">
            {form.line_items.map((item, i) => (
              <li key={`line-${i}`} className="flex items-center gap-2">
                <Input
                  aria-label={`Line item ${i + 1} name`}
                  placeholder="Item name"
                  value={item.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                  className="min-w-0 flex-1"
                />
                <CurrencyInput
                  aria-label={`Line item ${i + 1} price`}
                  valueCents={item.amount_cents}
                  onChangeCents={(cents) => updateLineItem(i, { amount_cents: Math.round(cents) })}
                  className="w-28 sm:w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 shrink-0 px-0"
                  disabled={form.line_items.length <= 1}
                  aria-label={`Remove line item ${i + 1}`}
                  onClick={() => setForm((f) => ({ ...f, line_items: f.line_items.filter((_, j) => j !== i) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, line_items: [...f.line_items, { description: "", amount_cents: 0 }] }))}
          >
            <Plus className="h-4 w-4" /> Add Line Item
          </Button>
        </fieldset>

        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm font-medium text-heading">Total</p>
          <p className="text-lg font-semibold tabular-nums text-heading" aria-live="polite">
            {formatCurrency(totalCents)}
          </p>
        </div>
        {paymentTerms ? <p className="text-sm leading-relaxed text-slate-600 surface-dark:text-foreground">{paymentTerms}</p> : null}

        <DepositControls form={form} setForm={setForm} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${uid}-expires`}>Expiration date</Label>
            <Input
              id={`${uid}-expires`}
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${uid}-notes`}>Notes</Label>
          <Textarea
            id={`${uid}-notes`}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {actions}
          <Button
            type="button"
            variant="outline"
            className="lg:hidden"
            aria-expanded={showMobilePreview}
            aria-controls={`${uid}-preview`}
            onClick={() => setShowMobilePreview((open) => !open)}
          >
            {showMobilePreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showMobilePreview ? "Hide preview" : "Preview PDF"}
          </Button>
        </div>
      </div>
      <div id={`${uid}-preview`} className={showMobilePreview ? "min-w-0" : "hidden min-w-0 lg:sticky lg:top-4 lg:block"}>
        <EstimatePdfPreview input={previewInput} logoUrl={logoUrl} />
      </div>
    </div>
  );
}

function DepositControls({
  form,
  setForm,
}: {
  form: EstimateFormState;
  setForm: (update: (current: EstimateFormState) => EstimateFormState) => void;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-heading">Deposit due on approval</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={name}
          className="size-4 shrink-0 accent-accent"
          checked={form.deposit_mode === "none"}
          onChange={() => setForm((f) => ({ ...f, deposit_mode: "none" }))}
        />
        Full project total
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={name}
          className="size-4 shrink-0 accent-accent"
          checked={form.deposit_mode === "percent"}
          onChange={() => setForm((f) => ({ ...f, deposit_mode: "percent" }))}
        />
        Percent of the quote
      </label>
      {form.deposit_mode === "percent" && (
        <div className="space-y-1 pl-6">
          <Label htmlFor={`${name}-percent`}>Deposit percent (1–99)</Label>
          <Input
            id={`${name}-percent`}
            type="number"
            min={1}
            max={99}
            value={form.deposit_percent}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!e.target.value || !Number.isFinite(n)) return;
              if (n < 1 || n > 99) return;
              setForm((f) => ({ ...f, deposit_percent: Math.round(n) }));
            }}
            className="w-28"
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={name}
          className="size-4 shrink-0 accent-accent"
          checked={form.deposit_mode === "amount"}
          onChange={() => setForm((f) => ({ ...f, deposit_mode: "amount" }))}
        />
        Fixed amount
      </label>
      {form.deposit_mode === "amount" && (
        <div className="pl-6">
          <CurrencyInput
            valueCents={form.deposit_amount_cents}
            onChangeCents={(cents) => setForm((f) => ({ ...f, deposit_amount_cents: cents }))}
            className="w-32"
          />
        </div>
      )}
    </fieldset>
  );
}
