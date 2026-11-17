import { Clock, Info, Layers, MapPin, ReceiptText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDuration } from "@/lib/booking/settings";
import type { ClientBookingView } from "@/lib/booking/client-view";
import { cn } from "@/lib/utils";

/**
 * Property · services · duration · estimate (travel broken out). The client's anchor on
 * every booking step: request received, choose a time, scheduled.
 */
export function RequestSummaryCard({ view, className, compact }: { view: ClientBookingView; className?: string; compact?: boolean }) {
  const estimate = view.estimate;
  const travel = estimate?.lines.filter((l) => l.travel) ?? [];
  const services = estimate?.lines.filter((l) => !l.travel) ?? [];
  const servicesTotal = services.reduce((sum, l) => sum + l.amountCents, 0);

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5", className)} aria-label="Your request">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr_0.8fr_1.1fr] lg:divide-x lg:divide-border">
        <div className="flex min-w-0 items-start gap-4">
          {view.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.coverUrl} alt="" className="h-20 w-28 shrink-0 rounded-xl object-cover sm:h-24 sm:w-36" />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent sm:h-24 sm:w-24">
              <MapPin className="h-8 w-8" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Property</p>
            <p className="mt-0.5 text-base font-semibold leading-snug text-heading sm:text-lg">{splitAddress(view.address).line1 || view.projectName}</p>
            {splitAddress(view.address).line2 ? <p className="text-sm text-muted">{splitAddress(view.address).line2}</p> : null}
          </div>
        </div>

        <div className="min-w-0 lg:pl-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Layers className="h-4 w-4 text-muted" aria-hidden /> Selected services
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {view.services.length ? (
              view.services.map((name) => (
                <li key={name} className="rounded-lg bg-subtle px-2.5 py-1 text-xs font-medium text-foreground">
                  {name}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">—</li>
            )}
          </ul>
        </div>

        <div className="lg:pl-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Clock className="h-4 w-4 text-muted" aria-hidden /> Estimated duration
          </p>
          <p className="mt-1.5 text-lg font-semibold text-heading">~ {formatDuration(view.durationMinutes)}</p>
          <p className="text-xs text-muted">On site (excluding travel)</p>
        </div>

        <div className="lg:pl-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            <ReceiptText className="h-4 w-4 text-muted" aria-hidden />
            {estimate?.kind === "official" ? "Estimate" : "Preliminary estimate"}
          </p>
          {estimate ? (
            <>
              <p className="mt-1 text-2xl font-bold tracking-tight text-heading">{formatCurrency(estimate.totalCents)}</p>
              {!compact ? (
                <dl className="mt-2 space-y-1 text-sm">
                  {services.length > 1 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Services</dt>
                      <dd className="font-medium text-heading">{formatCurrency(servicesTotal)}</dd>
                    </div>
                  ) : services.length === 1 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="truncate text-muted">{services[0].description}</dt>
                      <dd className="font-medium text-heading">{formatCurrency(services[0].amountCents)}</dd>
                    </div>
                  ) : null}
                  {travel.map((t) => (
                    <div key={t.description} className="flex justify-between gap-3">
                      <dt className="flex items-center gap-1 text-muted">
                        {t.description}
                        <span title="Based on driving distance to the property." className="inline-flex">
                          <Info className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </dt>
                      <dd className="font-medium text-heading">{formatCurrency(t.amountCents)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                    <dt className="font-semibold text-heading">Estimated total</dt>
                    <dd className="font-semibold text-heading">{formatCurrency(estimate.totalCents)}</dd>
                  </div>
                </dl>
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Custom quote — {view.businessName} will send pricing.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function splitAddress(address: string | null): { line1: string; line2: string } {
  if (!address) return { line1: "", line2: "" };
  const i = address.indexOf(",");
  if (i < 0) return { line1: address, line2: "" };
  return { line1: address.slice(0, i).trim(), line2: address.slice(i + 1).trim().replace(/,\s*(USA|United States)$/i, "") };
}
