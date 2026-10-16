"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/tools/pricing-math";
import {
  blankQuote,
  invoiceAmounts,
  line,
  QUOTE_TEMPLATES,
  sanitizeQuote,
  templateLines,
  todayIso,
  type DocKind,
  type Quote,
  type QuoteTemplateKey,
} from "@/lib/tools/quote-model";
import { fileSlug, saveFile } from "@/lib/tools/logo";
import { trackEngagement } from "@/lib/analytics/engagement";
import { useToolState } from "@/components/tools/use-tool-state";
import { NumberField, Segmented, TextField, Toggle } from "@/components/tools/controls";
import { BrandFields, useBrand } from "@/components/tools/brand-fields";
import { MoreOptions, Step, ToolStudio } from "@/components/tools/studio";
import { QuoteDocument } from "@/components/tools/quote-document";
import { cn } from "@/lib/utils";

type Line = Quote["lines"][number];

const FIELD =
  "w-full min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-[0.95rem] text-[#0F172A] outline-none transition-[border-color,box-shadow] placeholder:text-[#94A3B8] focus-visible:border-[#818CF8] focus-visible:ring-4 focus-visible:ring-[#4F46E5]/12";

/** One service: name and price up front; description, quantity, and "optional" one tap away. */
function LineRow({ l, i, kind, total, onChange, onRemove }: { l: Line; i: number; kind: DocKind; total: number; onChange: (p: Partial<Line>) => void; onRemove: () => void }) {
  const id = useId();
  const [open, setOpen] = useState(l.quantity !== 1 || Boolean(l.optional));
  const [priceText, setPriceText] = useState(l.unitPrice ? String(l.unitPrice) : "");
  useEffect(() => {
    setPriceText((t) => (Number(t.replace(/[$,\s]/g, "") || 0) === l.unitPrice ? t : l.unitPrice ? String(l.unitPrice) : ""));
  }, [l.unitPrice]);

  return (
    <li className="rounded-2xl border border-[#E2E8F0] bg-white p-3 sm:p-4">
      <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_7.5rem_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor={`${id}-d`} className="block text-xs font-medium text-[#64748B]">
            Service {i + 1}
          </label>
          <input id={`${id}-d`} className={cn(FIELD, "mt-1 font-medium")} value={l.description} maxLength={120} placeholder="e.g. Aerial photos" onChange={(e) => onChange({ description: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="block text-xs font-medium text-[#64748B]">
            Price
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">$</span>
            <input
              id={`${id}-p`}
              className={cn(FIELD, "pl-7 text-right tabular-nums")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={priceText}
              onChange={(e) => {
                setPriceText(e.target.value);
                const n = Number(e.target.value.replace(/[$,\s]/g, ""));
                if (Number.isFinite(n)) onChange({ unitPrice: Math.min(10_000_000, Math.max(0, n)) });
              }}
            />
          </div>
        </div>
        <button
          type="button"
          aria-label={`Remove service ${i + 1}`}
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-[#4F46E5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          {open ? "Hide details" : l.detail ? "Edit description or quantity" : "Add description or quantity"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {l.quantity !== 1 ? <span className="text-sm font-semibold tabular-nums text-[#0F172A]">{formatMoney(total)}</span> : null}
      </div>

      {open ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_6rem]">
          <TextField label="Description" value={l.detail ?? ""} onChange={(detail) => onChange({ detail })} maxLength={200} placeholder="What's included" />
          <NumberField label="Quantity" value={l.quantity} onChange={(quantity) => onChange({ quantity })} max={100000} />
          {kind === "quote" ? (
            <div className="sm:col-span-2">
              <Toggle checked={Boolean(l.optional)} onChange={(optional) => onChange({ optional })} label="Optional add-on" description="Listed separately and not added to the total." />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Quote or invoice builder: enter details on the left, see the finished document update on the
 * right, download a PDF with one click. Everything stays in this browser.
 */
export function DocumentBuilder({ kind = "quote", template = "real-estate", storageKey, analyticsId }: { kind?: DocKind; template?: QuoteTemplateKey; storageKey: string; analyticsId: string }) {
  const defaults = useMemo(() => blankQuote(template, kind), [template, kind]);
  const { state: q, setState, reset } = useToolState<Quote>({ storageKey, defaults, sanitize: sanitizeQuote, urlState: false });
  const { brand, setBrand } = useBrand();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInvoice = kind === "invoice";
  const doc: Quote = useMemo(() => ({ ...q, kind, business: brand }), [q, kind, brand]);
  const t = useMemo(() => invoiceAmounts(doc), [doc]);
  const label = isInvoice ? "invoice" : "quote";

  // Number and date are filled on the client (avoids a server/client date mismatch).
  useEffect(() => {
    if (q.number && q.issued) return;
    setState((s) => {
      if (s.number && s.issued) return s;
      const d = todayIso();
      return { ...s, issued: s.issued || d, number: s.number || `${isInvoice ? "INV" : "Q"}-${d.replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}` };
    });
  }, [q.number, q.issued, setState, isInvoice]);

  function update(patch: Partial<Quote> | ((s: Quote) => Quote)) {
    setState((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
    trackEngagement(`tool:${analyticsId}:started`);
  }
  const setLine = (id: string, patch: Partial<Line>) => update((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const setClient = (patch: Partial<Quote["client"]>) => update((s) => ({ ...s, client: { ...s.client, ...patch } }));
  const setProject = (patch: Partial<Quote["project"]>) => update((s) => ({ ...s, project: { ...s.project, ...patch } }));

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { buildQuotePdf } = await import("@/lib/tools/quote-pdf");
      saveFile(await buildQuotePdf(doc), `${fileSlug(brand.name, q.number || label, q.client.name)}.pdf`);
      trackEngagement(`tool:${analyticsId}:pdf`, { once: false });
    } catch {
      setError("The PDF couldn't be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <>
      <Step n={1} title="Add your business" hint={`Your logo and details go at the top of the ${label}. Saved on this device for next time.`}>
        <BrandFields brand={brand} onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))} />
      </Step>

      <Step n={2} title={isInvoice ? "Who are you billing?" : "Who is it for?"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Client name" value={q.client.name} onChange={(name) => setClient({ name })} placeholder="e.g. Jordan Lee" />
          <TextField label="Company" value={q.client.company} onChange={(company) => setClient({ company })} placeholder="Optional" />
          <TextField label="Client email" type="email" value={q.client.email} onChange={(email) => setClient({ email })} placeholder="Optional" wide />
          <TextField label="Project" value={q.project.title} onChange={(title) => setProject({ title })} placeholder="e.g. 12 Oak Street listing" wide />
          <TextField label="Address or location" value={q.project.location} onChange={(location) => setProject({ location })} placeholder="Optional" />
          <TextField label={isInvoice ? "Date of service" : "Shoot date"} type="date" value={q.project.date} onChange={(date) => setProject({ date })} />
        </div>
      </Step>

      <Step n={3} title={isInvoice ? "What are you billing for?" : "Services and prices"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[#64748B]">Fill in common services:</span>
          {(Object.keys(QUOTE_TEMPLATES) as QuoteTemplateKey[])
            .filter((k) => k !== "blank")
            .map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => update((s) => ({ ...s, lines: templateLines(k, kind), project: { ...s.project, title: s.project.title || QUOTE_TEMPLATES[k].title } }))}
                className="min-h-9 rounded-full border border-[#E2E8F0] px-3 text-sm font-medium text-[#334155] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
              >
                {QUOTE_TEMPLATES[k].label}
              </button>
            ))}
        </div>

        <ol className="mt-4 space-y-3">
          {q.lines.map((l, i) => (
            <LineRow key={l.id} l={l} i={i} kind={kind} total={t.lineTotals[l.id] ?? 0} onChange={(p) => setLine(l.id, p)} onRemove={() => update((s) => ({ ...s, lines: s.lines.filter((x) => x.id !== l.id) }))} />
          ))}
        </ol>
        <button
          type="button"
          onClick={() => update((s) => ({ ...s, lines: [...s.lines, line("")] }))}
          disabled={q.lines.length >= 40}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C7D2FE] text-sm font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a service
        </button>

        {isInvoice ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <NumberField label="Already paid" prefix="$" value={q.amountPaid} onChange={(amountPaid) => update({ amountPaid })} max={10000000} hint="A deposit or earlier payment. Use 0 if none." />
            <NumberField label="Payment due in" suffix="days" value={q.dueDays} onChange={(n) => update({ dueDays: Math.round(n) })} max={365} />
            <TextField label="How to pay" value={q.paymentInfo} onChange={(paymentInfo) => update({ paymentInfo })} multiline maxLength={600} placeholder="e.g. Pay online at yourbusiness.com/pay, or make checks payable to Skyline Aerial Media." wide />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <NumberField label="Deposit to book" suffix="%" value={q.depositType === "percent" ? q.depositValue : 0} onChange={(n) => update({ depositType: n > 0 ? "percent" : "none", depositValue: n })} max={100} hint="Use 0 for no deposit." />
            <NumberField label="Quote valid for" suffix="days" value={q.validDays} onChange={(n) => update({ validDays: Math.round(n) })} max={365} />
          </div>
        )}

        <MoreOptions label="More options: discount, tax, notes">
          <Segmented
            label="Discount"
            value={q.discountType}
            options={[
              { value: "none", label: "None" },
              { value: "percent", label: "%" },
              { value: "amount", label: "$" },
            ]}
            onChange={(discountType) => update({ discountType })}
          />
          {q.discountType !== "none" ? (
            <NumberField
              label={q.discountType === "percent" ? "Discount %" : "Discount amount"}
              prefix={q.discountType === "amount" ? "$" : undefined}
              suffix={q.discountType === "percent" ? "%" : undefined}
              value={q.discountValue}
              onChange={(discountValue) => update({ discountValue })}
              max={q.discountType === "percent" ? 100 : 10000000}
            />
          ) : (
            <span className="hidden sm:block" />
          )}
          <NumberField label="Sales tax" suffix="%" value={q.taxPct} onChange={(taxPct) => update({ taxPct })} max={100} hint="Only if it applies where you work." />
          <TextField label={isInvoice ? "Invoice number" : "Quote number"} value={q.number} onChange={(number) => update({ number })} />
          <TextField label={isInvoice ? "Invoice date" : "Quote date"} type="date" value={q.issued} onChange={(issued) => update({ issued })} />
          <span className="hidden sm:block" />
          <TextField label="Notes for the client" value={q.notes} onChange={(notes) => update({ notes })} multiline maxLength={1200} wide />
          <TextField label={isInvoice ? "Payment terms" : "Terms"} value={q.terms} onChange={(terms) => update({ terms })} multiline maxLength={2000} wide />
        </MoreOptions>
      </Step>
    </>
  );

  return (
    <ToolStudio
      id={`${analyticsId}-doc`}
      form={form}
      preview={<QuoteDocument quote={doc} />}
      barLabel={isInvoice ? "Balance due" : "Quote total"}
      barValue={formatMoney(isInvoice ? t.due : t.total)}
      onDownload={download}
      busy={busy}
      error={error}
      onReset={() => {
        reset();
        trackEngagement(`tool:${analyticsId}:reset`, { once: false });
      }}
    />
  );
}

/** The photography quote builder tool page's builder. */
export function QuoteBuilder() {
  return <DocumentBuilder kind="quote" template="real-estate" storageKey="sp:tool:quote:v2" analyticsId="quote-builder" />;
}
