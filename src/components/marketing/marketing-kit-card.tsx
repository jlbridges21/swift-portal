"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Globe, Loader2, Palette, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, type OfferMode, type ProductAccess } from "@/lib/marketing/offers";
import type { KitSummary } from "@/lib/marketing/server";
import { MarketingVisibilityToggle } from "@/components/admin/project-workspace/marketing-addons";

type Props = {
  projectId: string;
  summary: KitSummary;
  canManageOffers: boolean;
  canEdit: boolean;
  clientVisible?: boolean;
  visibilitySaving?: boolean;
  onClientVisibleChange?: (visible: boolean) => void;
};

function stateText(a: ProductAccess): { label: string; tone: string } {
  switch (a.state) {
    case "included":
      return { label: "Included", tone: "bg-emerald-50 text-emerald-700" };
    case "purchased":
      return a.purchase?.status === "comped"
        ? { label: "Included", tone: "bg-emerald-50 text-emerald-700" }
        : { label: `Purchased · ${formatCents(a.purchase?.amount_cents ?? 0)}`, tone: "bg-emerald-50 text-emerald-700" };
    case "pending_payment":
      return { label: "On client's invoice · unpaid", tone: "bg-amber-50 text-amber-800" };
    case "locked":
      return { label: `Available for purchase · ${formatCents(a.offer.priceCents)}`, tone: "bg-slate-100 text-slate-700" };
    default:
      return { label: "Not offered", tone: "bg-slate-100 text-slate-500" };
  }
}

function OfferControl({ projectId, product, summary, disabled }: { projectId: string; product: MarketingProduct; summary: KitSummary; disabled: boolean }) {
  const router = useRouter();
  const override = summary.offerOverrides[product];
  const def = summary.defaults[product];
  const [mode, setMode] = useState<"default" | OfferMode>(override?.mode ?? "default");
  const [price, setPrice] = useState<number>(override?.priceCents ?? def.priceCents);
  const [saving, setSaving] = useState(false);
  const dirty = mode !== (override?.mode ?? "default") || (mode === "paid" && price !== (override?.priceCents ?? def.priceCents));
  const defaultLabel = def.mode === "unavailable" ? "Not offered" : def.mode === "included" ? "Included" : `Paid · ${formatCents(def.priceCents)}`;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_offer", product, offer: mode === "default" ? null : mode === "paid" ? { mode, priceCents: price } : { mode } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      toast.success("Offer updated for this project");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          disabled={disabled}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm surface-dark:bg-card"
          aria-label={`${PRODUCT_LABEL[product]} offer for this project`}
        >
          <option value="default">Use business default ({defaultLabel})</option>
          <option value="included">Included (no charge)</option>
          <option value="paid">Paid add-on</option>
          <option value="unavailable">Not offered on this project</option>
        </select>
        {mode === "paid" ? (
          <div className="w-28">
            <CurrencyInput valueCents={price} onChangeCents={setPrice} />
          </div>
        ) : null}
        {dirty ? (
          <Button size="sm" variant="accent" disabled={saving || disabled} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted">{override ? "Overridden for this project." : "Inherited from Settings → Marketing Kit."} Changes never affect a purchase already made.</p>
    </div>
  );
}

export function MarketingKitCard({
  projectId,
  summary,
  canManageOffers,
  canEdit,
  clientVisible,
  visibilitySaving,
  onClientVisibleChange,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const editor = `/admin/projects/${projectId}/marketing`;

  async function post(action: string, body: Record<string, unknown>, ok: string) {
    setBusy(action + JSON.stringify(body));
    try {
      const res = await fetch(`/api/marketing/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "That didn't work");
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  if (summary.setupRequired) {
    return (
      <Card id="marketing-kit" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Marketing Kit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">Property websites and social graphics need a one-time database update (migration v118). Nothing else is affected.</p>
        </CardContent>
      </Card>
    );
  }

  const ready = summary.photoCount > 0;
  const ws = summary.websiteStatus;
  const products: { p: MarketingProduct; icon: typeof Globe; blurb: string }[] = [
    { p: "website", icon: Globe, blurb: "A premium single-property website built from this project." },
    { p: "social", icon: Palette, blurb: "Posts, stories, a carousel and a print flyer — ready to download." },
  ];

  return (
    <Card id="marketing-kit" className="scroll-mt-24 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Marketing Kit
          </CardTitle>
          <p className="mt-1 text-sm text-muted">
            {ready ? `Ready to preview — built from ${summary.photoCount} approved photo${summary.photoCount === 1 ? "" : "s"}.` : "Builds itself once client-visible photos are on this project."}
          </p>
        </div>
        {onClientVisibleChange ? (
          <MarketingVisibilityToggle
            visible={clientVisible ?? summary.visibleToClient}
            saving={visibilitySaving}
            nothingOffered={!summary.anyOffered}
            onChange={onClientVisibleChange}
          />
        ) : !summary.visibleToClient ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Hidden from client ·{" "}
            <Link href="/admin/settings#settings-marketing-kit" className="text-accent hover:underline">
              offer to clients
            </Link>
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Visible to client</span>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {products.map(({ p, icon: Icon, blurb }) => {
          const a = summary.access[p];
          const st = stateText(a);
          return (
            <div key={p} className="flex flex-col gap-4 rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-heading">{PRODUCT_LABEL[p]}</p>
                  <p className="text-xs text-muted">{blurb}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.tone)}>{st.label}</span>
                    {p === "website" && ws !== "none" ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ws === "published" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600")}>
                        {ws === "published" ? "Published" : ws === "unpublished" ? "Unpublished" : "Draft"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p === "website" ? (
                  ws === "published" && summary.liveUrl ? (
                    <>
                      <a href={summary.liveUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "accent", size: "sm" })}>
                        <ExternalLink className="h-4 w-4" /> View Website
                      </a>
                      <Link href={editor} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Edit Website
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(summary.liveUrl!).catch(() => undefined);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} Copy Link
                      </Button>
                    </>
                  ) : (
                    <Link href={editor} className={buttonVariants({ variant: ws === "none" ? "accent" : "outline", size: "sm" })}>
                      {ws === "none" ? "Create Property Website" : "Continue Editing"}
                    </Link>
                  )
                ) : (
                  <Link href={`${editor}?tab=social`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {a.hasAccess || a.state === "locked" ? "Open Social Kit" : "Preview Social Kit"}
                  </Link>
                )}
                {canManageOffers && (a.state === "locked" || a.state === "pending_payment") ? (
                  <>
                    {a.state === "locked" ? (
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void post("bill", { products: [p] }, "Added to the client's invoice")}>
                        Add to client&apos;s invoice
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void post("include", { product: p }, "Included at no charge")}>
                      Include free
                    </Button>
                  </>
                ) : null}
              </div>
              {canManageOffers ? (
                <details className="rounded-lg bg-slate-50 px-3 py-2 surface-dark:bg-subtle">
                  <summary className="cursor-pointer text-xs font-medium text-heading">Client offer for this project</summary>
                  <div className="pt-3">
                    <OfferControl projectId={projectId} product={p} summary={summary} disabled={!canEdit && !canManageOffers} />
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
        {!summary.listingDomainConnected ? (
          <p className="text-xs text-muted lg:col-span-2">
            Websites use your ShootPortal address until you{" "}
            <Link href={`/admin/settings?return=${encodeURIComponent(editor)}#settings-listing-domain`} className="text-accent hover:underline">
              set up listings.yourbusiness.com
            </Link>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
