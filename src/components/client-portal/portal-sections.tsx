"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Box, Check, CheckCircle2, Clapperboard, Clock, CreditCard, Download,
  ExternalLink, Eye, File, FileSpreadsheet, FileText, Globe, Images, Lock, Megaphone, Palette, Receipt,
  Rotate3d,
} from "lucide-react";
import { VideoGrid } from "@/components/projects/video-grid";
import { TourCard } from "@/components/projects/tour-card";
import { Model3dCard } from "@/components/projects/model-3d-card";
import { QuoteSection } from "@/components/projects/quote-section";
import { PaymentsSection } from "@/components/projects/payments-section";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { PortalCard, ThumbTile, useThumbUrls } from "@/components/client-portal/portal-ui";
import type { PortalCtx } from "@/components/client-portal/portal-context";
import { formatFileSize } from "@/lib/brand";
import { documentKindLabel, isPdf } from "@/lib/download";
import { mediaDisplayName } from "@/lib/media-display-name";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents } from "@/lib/marketing/offers";
import { getQuotePriceDisplay } from "@/lib/quote-display";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { MediaAsset } from "@/lib/types";

function TabHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Images;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function LockNote({ ctx, prefix }: { ctx: PortalCtx; prefix: string }) {
  if (ctx.downloadsUnlocked || !ctx.downloadLockMessage || ctx.isPreview) return null;
  return (
    <p className="mb-4 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted">
      <Lock className="h-4 w-4 shrink-0" /> {prefix} {ctx.downloadLockMessage}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export function VideosTab({ ctx }: { ctx: PortalCtx }) {
  const n = ctx.videoEntries.length;
  return (
    <div>
      <TabHeader icon={Clapperboard} title="Videos" subtitle={`${n} video${n === 1 ? "" : "s"} · tap a video to play`} />
      <LockNote ctx={ctx} prefix="Stream previews below." />
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-5">
        <VideoGrid
          entries={ctx.videoEntries}
          projectId={ctx.project.id}
          reviewByAssetId={ctx.reviewByAssetId}
          getDownloadUrl={ctx.getDownloadUrl}
          reviewPathPrefix="/dashboard/projects"
          downloadsAllowed={ctx.downloadsUnlocked}
          onDownload={(v) => void ctx.handleDownload(v)}
          canAccessVideoReviews={ctx.canAccessVideoReviews}
          canShareVideos={ctx.videoSharing?.canShare}
          publicVideoIds={ctx.videoSharing?.publicVideoIds}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 360 tours & 3D models (existing cards: embed when the provider allows it, link otherwise)
// ---------------------------------------------------------------------------

export function ToursTab({ ctx }: { ctx: PortalCtx }) {
  const n = ctx.tours.length;
  return (
    <div>
      <TabHeader
        icon={Rotate3d}
        title="360° Virtual Tours"
        subtitle={n > 1 ? `${n} interactive tours` : "Explore the space in 360°"}
      />
      <div className="space-y-5">
        {ctx.tours.map((tour) => (
          <div key={tour.id} className="overflow-hidden rounded-2xl border border-border shadow-sm">
            {tour.description ? <p className="border-b border-border bg-card px-5 py-3 text-sm text-muted">{tour.description}</p> : null}
            <TourCard tour={tour} embedInPortal />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModelsTab({ ctx }: { ctx: PortalCtx }) {
  const n = ctx.models.length;
  return (
    <div>
      <TabHeader icon={Box} title="3D Models" subtitle={n > 1 ? `${n} interactive models` : "Explore the interactive 3D model"} />
      <div className="space-y-5">
        {ctx.models.map((model) => (
          <div key={model.id} className="overflow-hidden rounded-2xl border border-border shadow-sm">
            <Model3dCard model={model} embedInPortal />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketing Kit — opens the existing marketing page for previews, purchase, customize, publish
// ---------------------------------------------------------------------------

const MARKETING_COPY: Record<MarketingProduct, { blurb: string; icon: typeof Globe }> = {
  website: { blurb: "A beautifully designed website for your listing, with its own shareable link.", icon: Globe },
  social: { blurb: "Ready-to-post graphics, stories, an Instagram carousel and a print flyer.", icon: Palette },
};

export function MarketingTab({ ctx }: { ctx: PortalCtx }) {
  const kit = ctx.marketingKit!;
  const base = `/dashboard/projects/${ctx.project.id}/marketing`;
  const previewIds = useMemo(
    () =>
      [...ctx.photos]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .slice(0, 4)
        .map((p) => p.id),
    [ctx.photos]
  );
  const urls = useThumbUrls(previewIds);
  const noPhotos = kit.photoCount === 0;
  const bothLocked = ctx.marketingProducts.length === 2 && ctx.marketingProducts.every((p) => kit.access[p].state === "locked");

  return (
    <div>
      <TabHeader icon={Megaphone} title="Marketing Kit" subtitle="Ready-to-use marketing built from your project's media." />
      {noPhotos ? (
        <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
          Your marketing kit is built from your photos. It will be ready to preview as soon as your photos are delivered.
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        {ctx.marketingProducts.map((p) => {
          const a = kit.access[p];
          const { blurb, icon: Icon } = MARKETING_COPY[p];
          const href = p === "website" ? base : `${base}?tab=social`;
          const live = p === "website" && kit.websiteStatus === "published" && kit.liveUrl ? kit.liveUrl : null;
          const status =
            a.state === "purchased"
              ? a.purchase?.status === "comped"
                ? { label: "Unlocked by your photographer", tone: "green" as const }
                : { label: "Purchased", tone: "green" as const }
              : a.state === "included"
                ? { label: "Included free", tone: "green" as const }
                : a.state === "pending_payment"
                  ? { label: "Payment pending", tone: "amber" as const }
                  : { label: formatCents(a.offer.priceCents), tone: "blue" as const };
          const primaryLabel = a.hasAccess
            ? p === "website"
              ? live
                ? "Edit Website"
                : "Customize & Publish"
              : "Open Social Media Kit"
            : a.state === "pending_payment"
              ? "View & Complete Payment"
              : `Preview & Unlock — ${formatCents(a.offer.priceCents)}`;
          return (
            <section key={p} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 p-5 surface-dark:from-subtle surface-dark:to-background">
                {p === "website" ? (
                  <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-md">
                    <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-red-300" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      <span className="ml-2 h-4 flex-1 rounded bg-slate-100 surface-dark:bg-subtle" />
                    </div>
                    <ThumbTile url={previewIds[0] ? urls[previewIds[0]] : null} className="aspect-[16/8]" />
                    <div className="grid grid-cols-3 gap-1.5 p-2">
                      {[1, 2, 3].map((i) => (
                        <ThumbTile key={i} url={previewIds[i] ? urls[previewIds[i]] : null} className="aspect-[4/3] rounded" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-md items-end justify-center gap-3">
                    <ThumbTile url={previewIds[0] ? urls[previewIds[0]] : null} className="aspect-square w-[38%] rounded-xl border border-border shadow-md" />
                    <ThumbTile url={previewIds[1] ? urls[previewIds[1]] : null} className="aspect-[9/16] w-[26%] rounded-xl border border-border shadow-md" />
                    <ThumbTile url={previewIds[2] ? urls[previewIds[2]] : null} className="aspect-[3/4] w-[28%] rounded-xl border border-border shadow-md" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-heading">{PRODUCT_LABEL[p]}</h2>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          status.tone === "green" && "bg-emerald-50 text-emerald-700",
                          status.tone === "amber" && "bg-amber-50 text-amber-800",
                          status.tone === "blue" && "bg-accent-subtle text-accent"
                        )}
                      >
                        {status.tone === "green" ? <Check className="h-3 w-3" /> : null}
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{blurb}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                  {live ? (
                    <a href={live} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "accent" }), "min-h-11 flex-1")}>
                      <ExternalLink className="h-4 w-4" /> View Property Website
                    </a>
                  ) : null}
                  {ctx.isPreview ? (
                    <span className={cn(buttonVariants({ variant: live ? "outline" : "accent" }), "min-h-11 flex-1 opacity-60")} aria-disabled>
                      {primaryLabel}
                    </span>
                  ) : (
                    <Link href={href} className={cn(buttonVariants({ variant: live ? "outline" : "accent" }), "min-h-11 flex-1")}>
                      {primaryLabel} <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {bothLocked && kit.bundlePriceCents && !Object.keys(kit.offerOverrides).length ? (
        <p className="mt-4 text-center text-sm text-muted">Get both for {formatCents(kit.bundlePriceCents)}.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function fileIcon(doc: MediaAsset) {
  const kind = documentKindLabel(doc);
  if (kind === "Excel" || kind === "CSV") return FileSpreadsheet;
  if (kind === "PDF" || kind === "Word") return FileText;
  return File;
}

export function FilesTab({ ctx }: { ctx: PortalCtx }) {
  const docs = ctx.documents;
  return (
    <div>
      <TabHeader icon={FileText} title="Files" subtitle={`${docs.length} file${docs.length === 1 ? "" : "s"} shared with you`} />
      <LockNote ctx={ctx} prefix="Preview available." />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {docs.map((doc) => {
          const Icon = fileIcon(doc);
          return (
            <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-heading" title={mediaDisplayName(doc)}>
                    {mediaDisplayName(doc)}
                  </p>
                  <p className="text-xs text-muted">
                    {[documentKindLabel(doc), doc.file_size ? formatFileSize(doc.file_size) : null, `Added ${formatDate(doc.created_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              {!ctx.isPreview ? (
                <div className="flex shrink-0 gap-2">
                  {isPdf(doc) ? (
                    <Button variant="outline" size="sm" className="min-h-10 flex-1 sm:flex-none" onClick={() => void ctx.handleView(doc)}>
                      <Eye className="h-4 w-4" /> Preview
                    </Button>
                  ) : null}
                  {ctx.downloadsUnlocked ? (
                    <Button
                      variant="accent"
                      size="sm"
                      className="min-h-10 flex-1 sm:flex-none"
                      aria-label={`Download ${mediaDisplayName(doc)}`}
                      onClick={() => void ctx.handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  ) : (
                    <span className="inline-flex min-h-10 items-center gap-1 text-xs text-muted">
                      <Lock className="h-3.5 w-3.5" /> Locked
                    </span>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estimate & Pay
// ---------------------------------------------------------------------------

export function EstimatePayTab({ ctx }: { ctx: PortalCtx }) {
  const f = ctx.financial;
  const { project } = ctx;
  return (
    <div className="mx-auto max-w-4xl">
      <TabHeader icon={CreditCard} title="Estimate & Pay" subtitle="Your proposal, payment status and receipts for this project." />
      <div className="space-y-5">
        <FinancialSummary ctx={ctx} />

        {f.failedPayments.length > 0 && f.kind !== "paid" ? (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            A previous payment attempt didn&apos;t go through. If you still owe a balance, a new payment request will appear here — or send us a message.
          </p>
        ) : null}

        {ctx.show.estimates ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <QuoteSection
              projectId={project.id}
              quotes={ctx.quotes}
              isAdmin={false}
              previewMode={ctx.isPreview}
              allowClientProposalChanges={ctx.allowClientProposalChanges}
              clientName={project.clients?.full_name || project.clients?.name || "Client"}
              projectName={project.project_name}
              propertyAddress={project.property_address}
              depositMode={ctx.depositMode}
              depositPercent={ctx.depositPercent}
              depositAmountCents={ctx.depositAmountCents}
            />
          </div>
        ) : null}

        {ctx.show.payments ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <PaymentsSection
              payments={ctx.payments}
              quotes={ctx.quotes}
              isPreview={ctx.isPreview}
              alwaysShow
              depositMode={ctx.depositMode}
              depositPercent={ctx.depositPercent}
              depositAmountCents={ctx.depositAmountCents}
              allowClientPayInFull={ctx.allowClientPayInFull}
              downloadsUnlocked={ctx.clientDownloadsUnlocked}
              optionalPaymentIds={ctx.financial.optionalCharges.map((c) => c.payment.id)}
              optionalPaymentLabels={Object.fromEntries(ctx.financial.optionalCharges.map((c) => [c.payment.id, c.label]))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Top panel: one clear statement of where the money stands, using the real payment rows. */
function FinancialSummary({ ctx }: { ctx: PortalCtx }) {
  const f = ctx.financial;
  const coverId = useMemo(() => {
    if (ctx.hero?.type === "image") return null;
    return [...ctx.photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]?.id ?? null;
  }, [ctx.hero, ctx.photos]);
  const urls = useThumbUrls(coverId ? [coverId] : []);
  const coverUrl = ctx.hero?.type === "image" ? ctx.hero.url : ctx.hero?.type === "youtube" ? ctx.hero.posterUrl : coverId ? urls[coverId] : null;
  const title = ctx.project.property_address?.trim() || ctx.project.project_name;
  const media = ctx.hasAnyMedia;

  if (f.kind === "paid") {
    const last = f.paidPayments[0];
    const receiptHref = last?.stripe_receipt_url || (last ? `/api/payments/${last.id}/receipt` : null);
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 surface-dark:from-card surface-dark:to-card sm:p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check className="h-7 w-7" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-heading sm:text-2xl">Payment Complete</p>
            <p className="text-sm text-muted">Your payment has been received.</p>
          </div>
          <span className="hidden items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 sm:inline-flex">
            <CheckCircle2 className="h-4 w-4" /> Paid
          </span>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border p-3 sm:flex-row sm:items-center">
          <ThumbTile url={coverUrl} className="aspect-[16/9] w-full shrink-0 rounded-xl sm:w-56" />
          <div className="min-w-0 sm:border-l sm:border-border sm:pl-5">
            <p className="truncate text-sm text-muted">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-heading">{formatCurrency(f.coveredCents)}</p>
            {last?.paid_at ? <p className="text-sm text-muted">Paid on {formatDate(last.paid_at)}</p> : null}
            {f.paidPayments.length > 1 ? <p className="text-xs text-muted">{f.paidPayments.length} payments</p> : null}
          </div>
        </div>
        {media ? (
          ctx.clientDownloadsUnlocked ? (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm surface-dark:bg-subtle">
              <Download className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-heading">Your media is available for download.</p>
                <p className="text-muted">Head to your gallery to download your files.</p>
              </div>
            </div>
          ) : ctx.downloadLockMessage ? (
            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-muted surface-dark:bg-subtle">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.downloadLockMessage}
            </p>
          ) : null
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="accent" className="min-h-11 sm:min-w-48" onClick={() => ctx.goTo("gallery")}>
            <ArrowLeft className="h-4 w-4" /> Return to Gallery
          </Button>
          {receiptHref ? (
            <a href={receiptHref} target={last?.stripe_receipt_url ? "_blank" : undefined} rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 sm:min-w-48")}>
              <Receipt className="h-4 w-4" /> View Receipt
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (f.kind === "due") {
    const first = f.openPayments[0];
    return (
      <SummaryPanel
        tone="red"
        icon={CreditCard}
        eyebrow="Payment due"
        amount={formatCurrency(f.dueCents)}
        lines={[
          f.openPayments.length > 1 ? `${f.openPayments.length} open payments` : first?.description || null,
          first?.due_date ? `Due ${formatDate(first.due_date)}` : null,
          f.coveredCents > 0 ? `${formatCurrency(f.coveredCents)} already paid` : null,
          f.optionalDueCents > 0
            ? `Also open: ${formatCurrency(f.optionalDueCents)} in optional Marketing Kit add-ons (${f.optionalCharges.map((c) => c.label).join(", ")}) — not required for your project.`
            : null,
          media && !ctx.clientDownloadsUnlocked ? "Downloads unlock once your payment is complete." : null,
        ]}
        action={
          <Button
            variant="accent"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => document.getElementById("payments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Pay Now — {formatCurrency(f.dueCents)}
          </Button>
        }
      />
    );
  }

  if (f.kind === "checkout") {
    return (
      <SummaryPanel
        tone="blue"
        icon={Megaphone}
        eyebrow="Marketing Kit Checkout"
        amount={formatCurrency(f.optionalDueCents)}
        lines={[
          ...f.optionalCharges.map((c) => `${c.label} — ${formatCurrency(c.payment.amount)}`),
          "These are optional add-ons. Nothing else is due right now, and your project media isn't affected — complete checkout whenever you're ready.",
        ]}
        action={
          <Button
            variant="accent"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => document.getElementById("payments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Complete Checkout — {formatCurrency(f.optionalDueCents)}
          </Button>
        }
      />
    );
  }

  if (f.kind === "review" && f.activeQuote) {
    const price = getQuotePriceDisplay(f.activeQuote.quote);
    return (
      <SummaryPanel
        tone="blue"
        icon={FileText}
        eyebrow="Estimate ready for review"
        amount={price.showPrice ? formatCurrency(price.priceCents) : null}
        lines={[f.activeQuote.quote.title, "Review the details below, then approve or request changes."]}
        action={
          <Button
            variant="accent"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => document.getElementById("quote")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Review Estimate <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    );
  }

  if (f.kind === "balance") {
    return (
      <SummaryPanel
        tone="amber"
        icon={CreditCard}
        eyebrow="Remaining balance"
        amount={formatCurrency(f.balanceCents)}
        lines={[`${formatCurrency(f.coveredCents)} paid so far.`, "Your next payment request will appear here when it's ready."]}
      />
    );
  }

  if (f.kind === "processing") {
    return (
      <SummaryPanel
        tone="amber"
        icon={Clock}
        eyebrow="Payment processing"
        amount={formatCurrency(f.processingPayments.reduce((s, p) => s + p.amount, 0))}
        lines={["Your bank payment is on its way. It usually clears in a few business days — no action needed."]}
      />
    );
  }

  if (f.kind === "estimate" && f.activeQuote) {
    const price = getQuotePriceDisplay(f.activeQuote.quote);
    return (
      <SummaryPanel
        tone="blue"
        icon={FileText}
        eyebrow={f.activeQuote.kind === "preliminary" ? "Preliminary estimate" : "Approved proposal"}
        amount={price.showPrice ? formatCurrency(price.priceCents) : null}
        lines={[
          f.activeQuote.quote.title,
          f.activeQuote.kind === "official" ? "No payment is due right now." : "Final pricing will be confirmed in your proposal.",
        ]}
      />
    );
  }

  return (
    <PortalCard>
      <EmptyState
        icon={CreditCard}
        title="Nothing to pay right now"
        description="Your estimate and any payment requests will appear here when your studio shares them."
      />
    </PortalCard>
  );
}

function SummaryPanel({
  tone,
  icon: Icon,
  eyebrow,
  amount,
  lines,
  action,
}: {
  tone: "red" | "blue" | "amber";
  icon: typeof CreditCard;
  eyebrow: string;
  amount: string | null;
  lines: (string | null)[];
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 shadow-sm sm:flex-row sm:items-center sm:p-6",
        tone === "red" && "border-red-200 bg-gradient-to-r from-red-50 to-white surface-dark:from-card surface-dark:to-card",
        tone === "blue" && "border-accent/25 bg-gradient-to-r from-accent-subtle to-white surface-dark:from-card surface-dark:to-card",
        tone === "amber" && "border-amber-200 bg-gradient-to-r from-amber-50 to-white surface-dark:from-card surface-dark:to-card"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            tone === "red" && "bg-red-100 text-red-600",
            tone === "blue" && "bg-accent/15 text-accent",
            tone === "amber" && "bg-amber-100 text-amber-700"
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              tone === "red" && "text-red-700",
              tone === "blue" && "text-accent",
              tone === "amber" && "text-amber-800"
            )}
          >
            {eyebrow}
          </p>
          {amount ? <p className="text-3xl font-bold tracking-tight text-heading">{amount}</p> : null}
          {lines.filter(Boolean).map((l) => (
            <p key={l} className="text-sm text-muted">
              {l}
            </p>
          ))}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
