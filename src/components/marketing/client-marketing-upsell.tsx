import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Globe, Palette, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents } from "@/lib/marketing/offers";
import type { KitSummary } from "@/lib/marketing/server";

/**
 * Delivery-time Marketing Kit offer in the client portal. Shows only products that are
 * available on this project; included products show as ready (no price, no checkout);
 * purchased products show their next action. Never blocks media delivery.
 */
export function ClientMarketingUpsell({ projectId, summary }: { projectId: string; summary: KitSummary }) {
  const base = `/dashboard/projects/${projectId}/marketing`;
  const products: { p: MarketingProduct; icon: typeof Globe; blurb: string; href: string }[] = [
    { p: "website", icon: Globe, blurb: "A beautifully designed website for your listing, with its own shareable link.", href: base },
    { p: "social", icon: Palette, blurb: "Ready-to-post graphics, stories, an Instagram carousel and a print flyer.", href: `${base}?tab=social` },
  ];
  const shown = products.filter(({ p }) => summary.access[p].state !== "unavailable");
  if (!shown.length || summary.photoCount === 0) return null;
  const anyLocked = shown.some(({ p }) => summary.access[p].state === "locked");

  return (
    <section aria-labelledby="mk-upsell" className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
      <div className="p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
          <Sparkles className="h-3.5 w-3.5" /> Marketing Kit
        </p>
        <h2 id="mk-upsell" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {anyLocked ? "Take your listing marketing further" : "Your listing marketing is ready"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          Your property&apos;s media is ready. We&apos;ve already turned it into a property website and ready-to-post social graphics — preview them with your real photos.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {shown.map(({ p, icon: Icon, blurb, href }) => {
            const a = summary.access[p];
            const owned = a.hasAccess;
            const live = p === "website" && summary.websiteStatus === "published" && summary.liveUrl;
            return (
              <div key={p} className="flex flex-col justify-between gap-4 rounded-xl bg-white/[0.07] p-5 ring-1 ring-white/10">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{PRODUCT_LABEL[p]}</p>
                      {owned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <Check className="h-3 w-3" /> {a.state === "included" || a.purchase?.status === "comped" ? "Included" : "Purchased"}
                        </span>
                      ) : a.state === "pending_payment" ? (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">Payment pending</span>
                      ) : (
                        <span className="text-sm font-semibold text-white/90">{formatCents(a.offer.priceCents)}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white/70">{blurb}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {live ? (
                    <a href={summary.liveUrl!} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "sm" }), "min-h-11 bg-white text-slate-900 hover:bg-white/90")}>
                      <ExternalLink className="h-4 w-4" /> View website
                    </a>
                  ) : null}
                  <Link href={href} className={cn(buttonVariants({ size: "sm" }), live ? "min-h-11 bg-white/10 text-white hover:bg-white/20" : "min-h-11 bg-white text-slate-900 hover:bg-white/90")}>
                    {owned ? (p === "website" ? (live ? "Edit website" : "Customize & publish") : "Customize & download") : "Preview"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        {anyLocked && summary.bundlePriceCents && shown.length === 2 && !Object.keys(summary.offerOverrides).length && summary.access.website.state === "locked" && summary.access.social.state === "locked" ? (
          <p className="mt-4 text-xs text-white/60">Get both for {formatCents(summary.bundlePriceCents)}.</p>
        ) : null}
      </div>
    </section>
  );
}
