import type { ProjectQuote, QuoteLineItem } from "@/lib/types";
import {
  CUSTOM_QUOTE_LABEL,
  estimateTotalPending,
  sectionIsCustomQuote,
  type EstimateSection,
} from "@/lib/estimate-sections";
import { cn, formatCurrency } from "@/lib/utils";

/** Deliverables grouped under each service heading (never one merged list). */
export function EstimateSectionsView({ sections, className }: { sections: EstimateSection[]; className?: string }) {
  if (!sections.length) return null;
  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => (
        <section
          key={`${section.heading}-${index}`}
          aria-label={section.heading}
          className="rounded-xl bg-slate-50/80 px-4 py-3.5 ring-1 ring-black/[0.03] surface-dark:bg-subtle/70"
        >
          <h4 className="text-sm font-semibold tracking-tight text-slate-900 surface-dark:text-heading">{section.heading}</h4>
          <div className="mt-1.5 space-y-1.5">
            {groupLines(section.lines).map((group, gi) =>
              group.kind === "bullets" ? (
                <ul key={gi} className="space-y-1.5">
                  {group.items.map((item, ii) => (
                    <li key={`${item}-${ii}`} className="flex gap-2.5 text-sm leading-relaxed text-slate-700 surface-dark:text-foreground">
                      <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : group.kind === "label" ? (
                <p
                  key={gi}
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.14em]",
                    sectionIsCustomQuote(section) ? "text-slate-500 surface-dark:text-muted" : "text-accent"
                  )}
                >
                  {group.text}
                </p>
              ) : (
                <p key={gi} className="text-sm leading-relaxed text-slate-600 surface-dark:text-muted">
                  {group.text}
                </p>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

type LineGroup = { kind: "bullets"; items: string[] } | { kind: "label" | "text"; text: string };

function groupLines(lines: EstimateSection["lines"]): LineGroup[] {
  const groups: LineGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (line.kind === "bullet") {
      if (last?.kind === "bullets") last.items.push(line.text);
      else groups.push({ kind: "bullets", items: [line.text] });
    } else {
      groups.push({ kind: line.kind, text: line.text });
    }
  }
  return groups;
}

/**
 * Per-service prices for a combined estimate: every priced line item, plus a
 * "Custom Quote" row for each custom-quoted service that has no priced line.
 * The total row is labelled as a subtotal while a custom quote is pending.
 */
export function EstimatePriceTable({
  quote,
  sections,
  className,
}: {
  quote: Pick<ProjectQuote, "line_items" | "total_cents" | "notes">;
  sections: EstimateSection[];
  className?: string;
}) {
  const items = ((quote.line_items ?? []) as QuoteLineItem[]).filter(
    (item) => item.amount_cents > 0 || (item.description.trim() && !/custom proposal required/i.test(item.description))
  );
  const pricedNames = new Set(items.filter((i) => i.amount_cents > 0).map((i) => i.description.trim().toLowerCase()));
  const customRows = sections.filter(
    (section) => sectionIsCustomQuote(section) && !pricedNames.has(section.heading.trim().toLowerCase())
  );
  const pending = estimateTotalPending(quote.notes) && quote.total_cents > 0;
  const priced = quote.total_cents > 0;

  return (
    <div className={cn("rounded-xl ring-1 ring-black/[0.05] surface-dark:ring-border", className)}>
      <ul className="divide-y divide-slate-100 surface-dark:divide-border">
        {items.map((item, index) => (
          <li key={`${item.description}-${index}`} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 text-slate-700 surface-dark:text-foreground">{item.description || "Item"}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900 surface-dark:text-heading">
              {formatCurrency(item.amount_cents)}
            </span>
          </li>
        ))}
        {customRows.map((section) => (
          <li key={`custom-${section.heading}`} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 text-slate-700 surface-dark:text-foreground">{section.heading}</span>
            <span className="shrink-0 font-medium text-slate-500 surface-dark:text-muted">{CUSTOM_QUOTE_LABEL}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-start justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50/80 px-4 py-3 surface-dark:border-border surface-dark:bg-subtle/70">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 surface-dark:text-heading">
            {pending ? "Priced services subtotal" : "Estimated total"}
          </p>
          {pending ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 surface-dark:text-muted">
              Not the final total — {customRows.length ? customRows.map((s) => s.heading).join(", ") : "a service"} still
              needs a custom quote.
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-base font-bold tabular-nums text-slate-900 surface-dark:text-heading">
          {priced ? formatCurrency(quote.total_cents) : CUSTOM_QUOTE_LABEL}
        </p>
      </div>
    </div>
  );
}
