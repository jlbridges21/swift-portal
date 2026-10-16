import { formatMoney } from "@/lib/tools/pricing-math";
import { formatDate } from "@/lib/tools/quote-model";
import type { Brand } from "@/lib/tools/brand";
import type { PriceSheet } from "@/lib/tools/defaults";
import { Letterhead, Paper } from "@/components/tools/quote-document";

export function sizeRange(from: number, upTo: number): string {
  return from ? `${from.toLocaleString("en-US")}–${upTo.toLocaleString("en-US")} sq ft` : `Up to ${upTo.toLocaleString("en-US")} sq ft`;
}

/** The agent-facing price list built by the real estate calculator. Mirrors price-sheet-pdf.ts. */
export function PriceSheetDocument({ brand, sheet, title, note, issued }: { brand: Brand; sheet: PriceSheet; title: string; note: string; issued: string }) {
  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join("  ·  ");
  return (
    <Paper label="Price list preview">
      <Letterhead brand={brand} title="Price list" meta={[["Effective", formatDate(issued)]]} />

      <h2 className="mt-7 text-xl font-bold tracking-tight">{title || "Real estate photography pricing"}</h2>
      <p className="mt-1 text-sm text-[#64748B]">Photo packages by home size</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {sheet.packages.map((p) => (
          <li key={p.upTo} className="rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-sm font-bold">{p.name}</p>
            <p className="text-xs text-[#64748B]">{sizeRange(p.from, p.upTo)}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-[#4F46E5]">{formatMoney(p.price, { whole: true })}</p>
            <p className="mt-1 text-xs text-[#475569]">{p.photos} edited photos</p>
          </li>
        ))}
      </ul>

      {sheet.addOns.length ? (
        <section className="mt-7">
          <h2 className="text-sm font-bold">Add to any package</h2>
          <ul className="mt-2 divide-y divide-[#F1F5F9] border-y border-[#F1F5F9] text-sm">
            {sheet.addOns.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 py-2.5">
                <span>{a.label}</span>
                <span className="font-semibold tabular-nums">{formatMoney(a.price, { whole: true })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {note.trim() ? <p className="mt-6 whitespace-pre-line break-words text-sm leading-relaxed text-[#475569]">{note}</p> : null}

      <div className="mt-7 rounded-xl bg-[#EEF2FF] px-4 py-3 text-sm">
        <span className="font-bold text-[#3730A3]">To book: </span>
        <span className="break-words text-[#334155]">{contact || "phone · email · website"}</span>
      </div>
    </Paper>
  );
}
