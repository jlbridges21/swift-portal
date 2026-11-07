import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatUsd, formatBillingDate } from "@/lib/trial-conversion";
import { introCountdownLabel, introOfferPromptCopy, introOfferSavingsLabel, type OfferDisplay } from "@/lib/intro-offer";

/**
 * Command Center: one calm card for trial owners who can still claim Subscribe & Save. Server
 * rendered from the same offer rules checkout enforces; disappears when the window closes, once
 * they subscribe, or for referred accounts (they see referral pricing on /billing instead).
 */
export function SubscribeSaveCard({ offer, nowMs }: { offer: OfferDisplay; nowMs: number }) {
  if (offer.kind !== "intro" || !offer.endsAt) return null;
  const msLeft = new Date(offer.endsAt).getTime() - nowMs;
  if (msLeft <= 0) return null;
  const copy = introOfferPromptCopy(msLeft);
  const m = offer.quotes.monthly;
  const a = offer.quotes.annual;
  return (
    <section
      aria-label="Subscribe and save"
      className="mb-8 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Subscribe &amp; Save · {introCountdownLabel(msLeft)} left
        </p>
        <p className="mt-1 font-semibold">{copy.headline}</p>
        <p className="mt-1 text-sm text-emerald-900/80">
          {m ? `${formatUsd(m.firstChargeCents)}/month for ${m.introInvoices} months` : null}
          {m && a ? " or " : null}
          {a ? `${formatUsd(a.firstChargeCents)} for your first year` : null}. Offer ends{" "}
          {formatBillingDate(offer.endsAt)}. Your projects, clients and settings stay exactly as they are.
        </p>
      </div>
      <Link href="/billing" className="shrink-0" data-sp-cta="command_center:subscribe_save">
        <Button variant="accent" className="min-h-11 w-full sm:w-auto">
          Subscribe &amp; Save {introOfferSavingsLabel()}
        </Button>
      </Link>
    </section>
  );
}
