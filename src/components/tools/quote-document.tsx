import type { ReactNode } from "react";
import { formatMoney } from "@/lib/tools/pricing-math";
import { addDays, formatDate, invoiceAmounts, type Quote } from "@/lib/tools/quote-model";
import type { Brand } from "@/lib/tools/brand";
import { cn } from "@/lib/utils";

/**
 * Paper-style live preview shared by every free-tool document. Mirrors the PDF layout
 * (lib/tools/pdf-base.ts). Carries no ShootPortal branding: it's the visitor's document.
 */
export function Paper({ label, children }: { label: string; children: ReactNode }) {
  return (
    <article
      className="tool-print-area quote-doc relative mx-auto w-full overflow-hidden rounded-xl bg-white px-4 pb-8 pt-8 text-[#0F172A] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 sm:px-9 sm:pb-10 sm:pt-11"
      aria-label={label}
    >
      <span className="absolute inset-x-0 top-0 h-1.5 bg-[#4F46E5]" aria-hidden />
      {children}
    </article>
  );
}

/** Letterhead: the visitor's logo and details on the left, the document title on the right. */
export function Letterhead({ brand, title, meta }: { brand: Brand; title: string; meta: [string, string][] }) {
  const contact = [brand.phone, brand.email].filter(Boolean).join("  ·  ");
  return (
    <header className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 sm:max-w-[60%]">
        {brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the visitor's own logo, kept in the browser as a data URL
          <img src={brand.logo} alt={brand.name ? `${brand.name} logo` : "Business logo"} className="mb-3 max-h-14 w-auto max-w-[11rem] object-contain object-left" />
        ) : (
          <span className="mb-3 flex h-12 w-28 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">Your logo</span>
        )}
        <p className={cn("break-words text-lg font-bold leading-snug", !brand.name && "text-[#64748B]")}>{brand.name || "Your business name"}</p>
        {brand.address ? <p className="break-words text-xs leading-relaxed text-[#475569]">{brand.address}</p> : null}
        {contact ? <p className="break-words text-xs leading-relaxed text-[#475569]">{contact}</p> : null}
        {brand.website ? <p className="break-words text-xs leading-relaxed text-[#475569]">{brand.website}</p> : null}
        {!brand.address && !contact && !brand.website ? <p className="text-xs text-[#64748B]">Phone · email · website</p> : null}
      </div>
      <div className="sm:text-right">
        <p className="text-2xl font-bold tracking-tight text-[#4F46E5] sm:text-[1.75rem]">{title}</p>
        <dl className="mt-2 space-y-0.5 text-xs">
          {meta
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="inline text-[#64748B]">{k} </dt>
                <dd className="inline font-semibold">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
    </header>
  );
}

function Lines({ label, lines, placeholder }: { label: string; lines: string[]; placeholder: string }) {
  const [first, ...rest] = lines;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={cn("mt-1 break-words text-sm font-semibold", !first && "text-[#64748B]")}>{first || placeholder}</p>
      {rest.map((l) => (
        <p key={l} className="break-words text-sm text-[#475569]">
          {l}
        </p>
      ))}
    </div>
  );
}

export function QuoteDocument({ quote }: { quote: Quote }) {
  const isInvoice = quote.kind === "invoice";
  const label = isInvoice ? "Invoice" : "Quote";
  const t = invoiceAmounts(quote);
  const included = quote.lines.filter((l) => !l.optional && (l.description || l.unitPrice));
  const optional = isInvoice ? [] : quote.lines.filter((l) => l.optional && (l.description || l.unitPrice));
  const until = quote.issued ? addDays(quote.issued, isInvoice ? quote.dueDays : quote.validDays) : "";

  return (
    <Paper label={`${label} preview`}>
      <Letterhead
        brand={quote.business}
        title={label}
        meta={[
          [isInvoice ? "Invoice no." : "Quote no.", quote.number],
          ["Date", formatDate(quote.issued)],
          [isInvoice ? "Due" : "Valid until", isInvoice || quote.validDays > 0 ? formatDate(until) : ""],
        ]}
      />

      <div className="grid gap-5 border-b border-[#E2E8F0] py-6 sm:grid-cols-2">
        <Lines label={isInvoice ? "Bill to" : "Prepared for"} lines={[quote.client.name, quote.client.company, quote.client.email].filter(Boolean)} placeholder="Client name" />
        <Lines
          label="Project"
          lines={[quote.project.title, quote.project.location, quote.project.date ? `${isInvoice ? "Date of service" : "Shoot date"}: ${formatDate(quote.project.date)}` : ""].filter(Boolean)}
          placeholder="Project"
        />
      </div>

      <table className="mt-6 w-full text-sm">
        <caption className="sr-only">{isInvoice ? "Billed services" : "Quoted services"}</caption>
        <thead>
          <tr className="bg-[#EEF2FF] text-left text-xs font-semibold text-[#3730A3]">
            <th scope="col" className="rounded-l-md px-2 py-2">
              Service
            </th>
            <th scope="col" className="w-12 py-2 text-right">
              Qty
            </th>
            <th scope="col" className="hidden w-24 py-2 text-right sm:table-cell">
              Rate
            </th>
            <th scope="col" className="w-28 rounded-r-md px-2 py-2 text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {included.length ? (
            included.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-2 py-3">
                  <p className="break-words font-semibold">{l.description || "Service"}</p>
                  {l.detail ? <p className="break-words text-xs leading-relaxed text-[#64748B]">{l.detail}</p> : null}
                </td>
                <td className="py-3 text-right tabular-nums">{l.quantity}</td>
                <td className="hidden py-3 text-right tabular-nums text-[#475569] sm:table-cell">{formatMoney(l.unitPrice)}</td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatMoney(t.lineTotals[l.id] ?? 0)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="py-6 text-center text-[#64748B]">
                Add a service and it appears here.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <Row k="Subtotal" v={formatMoney(t.subtotal)} />
          {t.discount > 0 ? <Row k={`Discount${quote.discountType === "percent" ? ` (${quote.discountValue}%)` : ""}`} v={`−${formatMoney(t.discount)}`} /> : null}
          {t.tax > 0 ? <Row k={`Tax (${quote.taxPct}%)`} v={formatMoney(t.tax)} /> : null}
          <div className="flex justify-between border-t border-[#E2E8F0] pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(t.total)}</dd>
          </div>
          {isInvoice ? (
            <>
              {t.paid > 0 ? <Row k="Paid" v={`−${formatMoney(t.paid)}`} /> : null}
              <Highlight k="Balance due" v={formatMoney(t.due)} />
            </>
          ) : t.deposit > 0 ? (
            <>
              <Highlight k={`Deposit to book${quote.depositType === "percent" ? ` (${quote.depositValue}%)` : ""}`} v={formatMoney(t.deposit)} />
              <Row k="Balance on delivery" v={formatMoney(t.balance)} />
            </>
          ) : null}
        </dl>
      </div>

      {optional.length ? (
        <section className="mt-8 rounded-xl border border-dashed border-[#CBD5E1] p-4">
          <h2 className="text-sm font-bold">Optional add-ons</h2>
          <p className="text-xs text-[#64748B]">Not included in the total. Ask to add any of these.</p>
          <ul className="mt-2 divide-y divide-[#F1F5F9] text-sm">
            {optional.map((l) => (
              <li key={l.id} className="flex justify-between gap-4 py-2">
                <span className="min-w-0 break-words">{l.description || "Add-on"}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(t.lineTotals[l.id] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(
        [
          ["How to pay", isInvoice ? quote.paymentInfo : ""],
          ["Notes", quote.notes],
          [isInvoice ? "Payment terms" : "Terms", quote.terms],
        ] as const
      ).map(([title, body]) =>
        body.trim() ? (
          <section key={title} className="mt-7">
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-[#475569]">{body}</p>
          </section>
        ) : null
      )}

      {isInvoice ? (
        <p className="mt-10 text-sm font-bold text-[#4F46E5]">Thank you for your business.</p>
      ) : (
        <footer className="mt-10 grid gap-8 text-sm sm:grid-cols-2">
          <div>
            <div className="h-8 border-b border-[#94A3B8]" />
            <p className="mt-1 text-xs text-[#64748B]">Accepted by (name and signature)</p>
          </div>
          <div>
            <div className="h-8 border-b border-[#94A3B8]" />
            <p className="mt-1 text-xs text-[#64748B]">Date</p>
          </div>
        </footer>
      )}
    </Paper>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#475569]">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

function Highlight({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-[#4F46E5] px-3 py-2 font-bold text-white">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
