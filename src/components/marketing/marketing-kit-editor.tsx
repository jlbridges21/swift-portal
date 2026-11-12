"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Lock,
  Monitor,
  Palette,
  SlidersHorizontal,
  PanelsTopLeft,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmbeddedCheckoutModal, postStartCheckout, useCheckoutReturn } from "@/components/payments/embedded-checkout-modal";
import { paymentCheckoutPath } from "@/lib/payment-status";
import { cn } from "@/lib/utils";
import { MarketingFontFaces } from "@/components/marketing/website/listing-website";
import { useKit, kitFetch, type KitApi } from "@/components/marketing/editor/use-kit";
import {
  BrandingPanel,
  DesignPicker,
  PanelSection,
  PhotosPanel,
  PropertyPanel,
  SectionsPanel,
  SocialAssetsPanel,
} from "@/components/marketing/editor/panels";
import { WebsitePreview } from "@/components/marketing/editor/previews";
import { SocialWorkspace } from "@/components/marketing/editor/social-workspace";
import { buildListingView, socialAssetStatuses, type UrlResolver } from "@/lib/marketing/view-model";
import { buildSocialItems, type SocialItem } from "@/lib/marketing/social-inputs";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, type ProductAccess } from "@/lib/marketing/offers";
import type { KitClientState } from "@/lib/marketing/server";

type Tab = "website" | "social";

export type MarketingKitEditorProps = {
  initialState: KitClientState;
  backHref: string;
  /** Opened from Sites → Property Websites: extra link back to that library. */
  sitesHref?: string | null;
  initialTab?: Tab;
  paymentReturn?: string | null;
  /** Image URL strategy (defaults to the authorized /api/marketing routes). */
  urlFactory?: (state: KitClientState) => UrlResolver;
};

function accessLabel(a: ProductAccess): { text: string; tone: "green" | "amber" | "slate" } {
  switch (a.state) {
    case "included":
      return { text: "Included", tone: "green" };
    case "purchased":
      return { text: a.purchase?.status === "comped" ? "Included" : "Purchased", tone: "green" };
    case "pending_payment":
      return { text: "Payment pending", tone: "amber" };
    case "locked":
      return { text: formatCents(a.offer.priceCents), tone: "slate" };
    default:
      return { text: "Not offered", tone: "slate" };
  }
}

function Chip({ tone, children }: { tone: "green" | "amber" | "slate" | "blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", cls)}>{children}</span>;
}

function websiteStatusChip(s: KitClientState["website"]) {
  if (s.status === "published") return s.hasUnpublishedChanges ? <Chip tone="amber">Unpublished changes</Chip> : <Chip tone="green">Published</Chip>;
  if (s.status === "unpublished") return <Chip tone="slate">Unpublished</Chip>;
  return <Chip tone="blue">Draft</Chip>;
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

function PurchaseDialog({ kit, open, onClose, preselect }: { kit: KitApi; open: boolean; onClose: () => void; preselect: MarketingProduct | null }) {
  const s = kit.state;
  const lockable = (["website", "social"] as MarketingProduct[]).filter((p) => s.access[p].state === "locked" || s.access[p].state === "pending_payment");
  const [chosen, setChosen] = useState<MarketingProduct[]>(preselect ? [preselect] : lockable);
  const [method, setMethod] = useState<"pay_now" | "add_to_invoice">("pay_now");
  const [working, setWorking] = useState(false);
  const [checkoutPaymentId, setCheckoutPaymentId] = useState<string | null>(null);
  useEffect(() => {
    if (open) setChosen(preselect && lockable.includes(preselect) ? [preselect] : lockable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect]);

  const sum = chosen.reduce((t, p) => t + s.access[p].offer.priceCents, 0);
  const bundle =
    chosen.length === 2 && s.bundlePriceCents && s.access.website.offer.source === "default" && s.access.social.offer.source === "default" && s.bundlePriceCents < sum
      ? s.bundlePriceCents
      : null;
  const total = bundle ?? sum;

  async function submit() {
    if (!chosen.length) return;
    setWorking(true);
    try {
      const { paymentId } = await kitFetch<{ paymentId: string }>(`/api/marketing/${s.projectId}/purchase`, {
        method: "POST",
        body: JSON.stringify({ products: chosen, method }),
      });
      if (method === "add_to_invoice") {
        toast.success("Added to your project invoice. It unlocks as soon as it's paid.");
        await kit.refresh();
        onClose();
        return;
      }
      // Pay inside ShootPortal (embedded Stripe checkout) — no redirect to Stripe.
      setCheckoutPaymentId(paymentId);
      setWorking(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
      setWorking(false);
    }
  }

  if (checkoutPaymentId) {
    return (
      <MarketingCheckout
        kit={kit}
        paymentId={checkoutPaymentId}
        onClose={() => {
          setCheckoutPaymentId(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Unlock your Marketing Kit"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={working}>
            Not now
          </Button>
          <Button variant="accent" onClick={() => void submit()} disabled={working || !chosen.length} className="min-h-11">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : method === "pay_now" ? <CreditCard className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {method === "pay_now" ? `Pay ${formatCents(total)}` : `Add ${formatCents(total)} to invoice`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">You&apos;re seeing the real thing — your photos, your details. Unlock to publish and download.</p>
        <div className="space-y-2">
          {lockable.map((p) => (
            <label key={p} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4", chosen.includes(p) ? "border-accent bg-accent/5" : "border-border")}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={chosen.includes(p)}
                onChange={(e) => setChosen((c) => (e.target.checked ? [...c, p] : c.filter((x) => x !== p)))}
              />
              <span className="flex-1">
                <span className="block font-semibold text-heading">{PRODUCT_LABEL[p]}</span>
                <span className="block text-xs text-muted">{p === "website" ? "Publish a beautiful listing website with its own link." : "Full-resolution posts, stories, carousel and print flyer."}</span>
              </span>
              <span className="font-semibold">{formatCents(s.access[p].offer.priceCents)}</span>
            </label>
          ))}
        </div>
        {bundle ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Bundle price: <strong>{formatCents(bundle)}</strong> <span className="line-through opacity-60">{formatCents(sum)}</span>
          </p>
        ) : null}
        {s.permissions.canAddToInvoice ? (
          <div className="grid grid-cols-2 gap-2">
            {(["pay_now", "add_to_invoice"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-xl border px-3 py-3 text-left text-sm", method === m ? "border-accent bg-accent/5" : "border-border")}>
                <span className="block font-semibold">{m === "pay_now" ? "Pay now" : "Add to invoice"}</span>
                <span className="block text-xs text-muted">{m === "pay_now" ? "Unlocks right after payment" : "Pay later with your project balance"}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Domain notice (business, first-time)
// ---------------------------------------------------------------------------

function DomainNotice({ state, projectId }: { state: KitClientState; projectId: string }) {
  const key = `mk-domain-notice-dismissed`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);
  if (!state.permissions.isBusiness || state.listingDomain.connected || hidden) return null;
  const pending = Boolean(state.listingDomain.domain);
  const back = encodeURIComponent(`/admin/projects/${projectId}/marketing`);
  return (
    <div className="m-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
      <div className="flex items-start gap-3">
        <Globe className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{pending ? "Your property website address is almost ready" : "Use your own domain for property websites"}</p>
          <p className="mt-1 text-sky-900/80">
            {pending
              ? `${state.listingDomain.domain} is waiting on DNS. Until it connects, websites use your ShootPortal address.`
              : "Your property websites can use a branded address like listings.yourbusiness.com."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/settings?return=${back}#settings-listing-domain`} className={buttonVariants({ variant: "accent", size: "sm" })}>
              {pending ? "Check domain status" : "Set Up Custom Domain"}
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  window.localStorage.setItem(key, "1");
                } catch {
                  /* ignore */
                }
                setHidden(true);
              }}
            >
              Continue with ShootPortal Address
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Embedded checkout for a Marketing Kit add-on payment. Access unlocks only once the server confirms payment. */
function MarketingCheckout({ kit, paymentId, resumeSessionId, onClose }: { kit: KitApi; paymentId: string; resumeSessionId?: string; onClose: () => void }) {
  const startCheckout = useCallback(
    ({ method }: { method: "card" | "bank" }) =>
      postStartCheckout(paymentCheckoutPath(paymentId), { method, returnTo: "marketing", embedded: true }),
    [paymentId]
  );
  const refreshUntilUnlocked = useCallback(async () => {
    for (let n = 0; n < 6; n++) {
      const next = await kit.refresh();
      if (next && (next.access.website.hasAccess || next.access.social.hasAccess)) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, [kit]);
  return (
    <EmbeddedCheckoutModal
      open
      onClose={() => {
        onClose();
        void kit.refresh();
      }}
      startCheckout={startCheckout}
      statusUrl={(sessionId) => `${paymentCheckoutPath(paymentId)}/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`}
      resumeSessionId={resumeSessionId}
      title="Marketing Kit"
      onSettled={(outcome) => {
        if (outcome.state === "paid") void refreshUntilUnlocked();
      }}
      paidMessage="Your Marketing Kit is unlocked — publish your website and download your posts."
      fallbackReceiptHref={`/api/payments/${paymentId}/receipt`}
      doneLabel="Back to Marketing Kit"
    />
  );
}

/** Return from a redirect-based payment method: verify the session in the checkout modal. */
function MarketingCheckoutResume({ kit }: { kit: KitApi }) {
  const returned = useCheckoutReturn((id) => kit.state.access.website.pendingPaymentId === id || kit.state.access.social.pendingPaymentId === id);
  const [dismissed, setDismissed] = useState(false);
  if (!returned?.paymentId || dismissed) return null;
  return <MarketingCheckout kit={kit} paymentId={returned.paymentId} resumeSessionId={returned.sessionId} onClose={() => setDismissed(true)} />;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function MarketingKitEditor({ initialState, backHref, sitesHref = null, initialTab = "website", paymentReturn, urlFactory }: MarketingKitEditorProps) {
  const kit = useKit(initialState, urlFactory);
  const router = useRouter();
  const s = kit.state;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [previewing, setPreviewing] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setDevice("mobile");
  }, []);
  const [drawer, setDrawer] = useState(false);
  const [purchase, setPurchase] = useState<MarketingProduct | null | false>(false);
  const [selectedAsset, setSelectedAsset] = useState<string>("sq_just_listed");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Stripe return: the webhook may land a moment later — refresh a few times.
  useEffect(() => {
    if (paymentReturn === "success" || paymentReturn === "bank_started") {
      toast.success(paymentReturn === "success" ? "Payment received — unlocking your Marketing Kit…" : "Bank payment started. It unlocks when it clears.");
      let n = 0;
      const t = setInterval(async () => {
        n++;
        const next = await kit.refresh();
        if ((next && (next.access.website.hasAccess || next.access.social.hasAccess)) || n >= 6) clearInterval(t);
      }, 2500);
      router.replace(window.location.pathname);
      return () => clearInterval(t);
    }
    if (paymentReturn === "cancelled") {
      toast("Checkout cancelled — nothing was charged.");
      router.replace(window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useMemo(
    () => buildListingView({ content: kit.content, media: s.media, tours: s.tours, coverId: s.coverId, businessName: s.businessName, urls: kit.urls }),
    [kit.content, s.media, s.tours, s.coverId, s.businessName, kit.urls]
  );
  const hasPhotos = s.media.some((m) => m.type === "photo");
  const socialLocked = !s.access.social.hasAccess && !s.permissions.isBusiness;
  const websiteLocked = !s.access.website.hasAccess;
  const websiteUrl = s.website.status === "published" ? s.website.liveUrl : null;
  const thumbItems = useMemo(
    () =>
      buildSocialItems({
        content: kit.content,
        media: s.media,
        coverId: s.coverId,
        view,
        photoUrl: (id) => (id ? kit.urls.image({ kind: "media", id }, "thumb") : null),
        watermark: socialLocked,
        includeAll: true,
        websiteUrl,
      }),
    [kit.content, s.media, s.coverId, view, kit.urls, socialLocked, websiteUrl]
  );
  const focusedItem = useMemo(() => {
    const items = buildSocialItems({
      content: kit.content,
      media: s.media,
      coverId: s.coverId,
      view,
      photoUrl: (id) => (id ? kit.urls.image({ kind: "media", id }, "medium") : null),
      watermark: socialLocked,
      includeAll: true,
      websiteUrl,
    });
    const exact = items.find((i) => i.id === selectedAsset);
    if (exact) return exact;
    // A removed carousel slide: stay in the carousel on its last slide.
    const group = selectedAsset.startsWith("carousel-") ? "carousel" : null;
    return (group ? items.filter((i) => i.group === group).pop() : null) ?? items[0] ?? null;
  }, [kit.content, s.media, s.coverId, view, kit.urls, socialLocked, selectedAsset, websiteUrl]);
  const statuses = useMemo(() => socialAssetStatuses(kit.content, hasPhotos), [kit.content, hasPhotos]);
  const enabledIds = thumbItems.filter((i) => !i.status || (i.status.available && i.status.enabled)).filter((i) => i.group !== "carousel" || kit.content.social.includeCarousel).map((i) => i.id);

  const websiteRibbon = websiteLocked
    ? s.permissions.isBusiness
      ? s.access.website.state === "unavailable"
        ? "Not offered on this project"
        : "Preview — paid add-on the client hasn't purchased"
      : "Preview — purchase the Property Website to publish it"
    : null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(s.website.liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function publish() {
    setConfirmPublish(false);
    const next = await kit.action("publish", {}, s.website.status === "published" ? "Changes published" : "Your property website is live!");
    if (next) setDrawer(false);
  }

  /** Full-page draft preview in a new tab (business only). Saves pending edits first. */
  async function openPreview() {
    const url = `/property-preview/${s.projectId}`;
    if (kit.saveState === "saved") {
      window.open(url, "_blank", "noopener");
      return;
    }
    // Open the tab inside the click so popup blockers allow it, then point it at the preview
    // once the latest edits are saved.
    const win = window.open("", "_blank");
    if (win) {
      win.opener = null;
      win.document.title = "Preparing preview…";
      win.document.body.style.cssText = "font:14px system-ui,sans-serif;color:#64748b;display:grid;place-items:center;height:100vh;margin:0";
      win.document.body.textContent = "Preparing preview…";
    }
    setPreviewing(true);
    const saved = await kit.saveNow();
    setPreviewing(false);
    if (!saved) toast.error("Your latest changes couldn't be saved, so the preview shows the last saved version.");
    if (win) win.location.href = url;
    else window.open(url, "_blank", "noopener");
  }

  async function download(item: SocialItem | "all") {
    const id = item === "all" ? "all" : item.id;
    setDownloading(id);
    try {
      const url = item === "all" ? `/api/marketing/${s.projectId}/export?item=all&ids=${encodeURIComponent(enabledIds.join(","))}` : `/api/marketing/${s.projectId}/export?item=${encodeURIComponent(item.id)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "marketing-kit";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  const saveText = { saved: "All changes saved", dirty: "Unsaved changes…", saving: "Saving…", error: "Not saved" }[kit.saveState];
  const publishLabel = s.website.status === "published" ? "Publish changes" : "Publish website";
  const canBusinessPublish = s.permissions.isBusiness && s.permissions.canPublish && s.access.website.state !== "unavailable";

  // ------- primary actions (top bar) -------
  const websiteActions = (
    <div className="flex flex-wrap items-center gap-2">
      {s.website.status === "published" ? (
        <>
          <a href={s.website.liveUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink className="h-4 w-4" /> View website
          </a>
          <Button size="sm" variant="outline" onClick={() => void copyLink()}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} Copy link
          </Button>
        </>
      ) : null}
      {s.permissions.isBusiness && (s.website.status !== "published" || s.website.hasUnpublishedChanges) ? (
        <Button size="sm" variant="outline" disabled={previewing} onClick={() => void openPreview()} title="Open the full website in a new tab (private to your business)">
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview<span className="hidden sm:inline"> website</span>
        </Button>
      ) : null}
      {(s.permissions.isBusiness ? canBusinessPublish : s.permissions.canPublish) ? (
        s.website.status !== "published" || s.website.hasUnpublishedChanges ? (
          <Button size="sm" variant="accent" disabled={kit.busy === "publish" || !hasPhotos} onClick={() => (s.permissions.isBusiness && websiteLocked ? setConfirmPublish(true) : void publish())}>
            {kit.busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} {publishLabel}
          </Button>
        ) : null
      ) : !s.permissions.isBusiness && (s.access.website.state === "locked" || s.access.website.state === "pending_payment") ? (
        <Button size="sm" variant="accent" onClick={() => setPurchase("website")}>
          <Lock className="h-4 w-4" /> {s.access.website.state === "pending_payment" ? "Complete purchase" : `Purchase · ${formatCents(s.access.website.offer.priceCents)}`}
        </Button>
      ) : null}
    </div>
  );
  const socialActions = (
    <div className="flex flex-wrap items-center gap-2">
      {s.permissions.canDownload ? (
        <Button size="sm" variant="accent" disabled={downloading !== null || !hasPhotos || !enabledIds.length} onClick={() => void download("all")}>
          {downloading === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download kit (ZIP)
        </Button>
      ) : s.access.social.state === "locked" || s.access.social.state === "pending_payment" ? (
        <Button size="sm" variant="accent" onClick={() => setPurchase("social")}>
          <Lock className="h-4 w-4" /> {s.access.social.state === "pending_payment" ? "Complete purchase" : `Purchase · ${formatCents(s.access.social.offer.priceCents)}`}
        </Button>
      ) : null}
    </div>
  );

  // ------- panels -------
  const websitePanel = (
    <>
      <DomainNotice state={s} projectId={s.projectId} />
      <PanelSection title="Design" subtitle="Modern, Luxury or Coastal" defaultOpen>
        <DesignPicker value={kit.content.website.template} disabled={!s.permissions.canEdit} onChange={(t) => kit.update((o) => ({ ...o, website: { ...(o.website ?? {}), template: t } }))} />
      </PanelSection>
      <PanelSection title="Property details" subtitle="Shared with your social kit">
        <PropertyPanel kit={kit} />
      </PanelSection>
      <PanelSection title="Photos & media" subtitle="Hero, gallery, floor plans, videos">
        <PhotosPanel kit={kit} />
      </PanelSection>
      <PanelSection title="Sections" subtitle="Show, hide and reorder">
        <SectionsPanel kit={kit} />
      </PanelSection>
      <PanelSection title="Agent & branding" subtitle={`${kit.content.branding.source === "business" ? "Photography business" : kit.content.branding.source === "brokerage" ? "Brokerage" : "Realtor"} branding`}>
        <BrandingPanel kit={kit} />
      </PanelSection>
      <PanelSection title="Website address" subtitle={s.website.liveUrl.replace(/^https?:\/\//, "")}>
        <WebsiteAddress kit={kit} />
      </PanelSection>
    </>
  );
  const socialPanel = (
    <>
      <PanelSection title="Design" subtitle="Modern, Luxury or Coastal" defaultOpen>
        <DesignPicker value={kit.content.social.style} disabled={!s.permissions.canEdit} onChange={(t) => kit.update((o) => ({ ...o, social: { ...(o.social ?? {}), style: t } }))} />
      </PanelSection>
      <PanelSection title="Graphics in your kit" subtitle="Choose what the Download Kit includes" defaultOpen>
        <SocialAssetsPanel kit={kit} statuses={statuses} selected={selectedAsset} onSelect={(id) => { setSelectedAsset(id); setDrawer(false); }} />
      </PanelSection>
      <PanelSection title="Property details" subtitle="Shared with your website">
        <PropertyPanel kit={kit} />
      </PanelSection>
      <PanelSection title="Agent & branding" subtitle="Shared with your website">
        <BrandingPanel kit={kit} />
      </PanelSection>
    </>
  );
  const panel = tab === "website" ? websitePanel : socialPanel;

  // ------- previews -------
  const websitePreview = hasPhotos ? (
    <WebsitePreview view={view} device={device} ribbon={websiteRibbon} />
  ) : (
    <EmptyMedia business={s.permissions.isBusiness} />
  );
  const tabs: { id: Tab; label: string; product: MarketingProduct; chip: React.ReactNode }[] = [
    { id: "website", label: "Property Website", product: "website", chip: s.access.website.hasAccess || s.permissions.isBusiness ? websiteStatusChip(s.website) : <Chip tone={accessLabel(s.access.website).tone}>{accessLabel(s.access.website).text}</Chip> },
    { id: "social", label: "Social Media Kit", product: "social", chip: <Chip tone={accessLabel(s.access.social).tone}>{accessLabel(s.access.social).text}</Chip> },
  ];

  return (
    <div className="flex h-[var(--app-height)] flex-col bg-slate-50 surface-dark:bg-background">
      <MarketingFontFaces />
      {/* Top bar */}
      <header className="shrink-0 border-b border-border bg-white surface-dark:bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-2 sm:px-4 sm:py-3">
          <Link
            href={backHref}
            aria-label="Back to project"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-sm text-muted hover:text-heading active:bg-slate-100 sm:min-h-0 sm:min-w-0 sm:justify-start sm:rounded-none sm:active:bg-transparent surface-dark:active:bg-subtle"
          >
            <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Back to project</span>
          </Link>
          {sitesHref ? (
            <Link
              href={sitesHref}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-muted hover:border-accent/40 hover:text-accent surface-dark:bg-card"
            >
              <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Property Websites</span>
              <span className="sm:hidden">Sites</span>
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-heading">
              <Sparkles className="h-4 w-4 text-accent" /> Marketing Kit
            </p>
            <p className="truncate text-xs text-muted">
              {kit.content.property.address || s.projectName}
              {/* Phones: the save status lives here (the desktop shows it beside the actions). */}
              <span className={cn("md:hidden", kit.saveState === "error" && "text-red-600")}> · {s.permissions.canEdit ? saveText : "View only"}</span>
            </p>
          </div>
          <p className={cn("hidden text-xs md:block", kit.saveState === "error" ? "text-red-600" : "text-muted")} aria-live="polite">
            {s.permissions.canEdit ? saveText : "View only"}
          </p>
          <div className="hidden md:block">{tab === "website" ? websiteActions : socialActions}</div>
        </div>
        <nav className="flex gap-1 px-3" aria-label="Marketing Kit">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn("flex min-h-11 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium md:min-h-0", tab === t.id ? "border-accent text-heading" : "border-transparent text-muted hover:text-heading")}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.id === "website" ? <Globe className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
              {t.label}
              <span className="hidden sm:inline">{t.chip}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Locked / pending banners */}
      {!s.permissions.isBusiness && !s.access[tab].hasAccess ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 sm:text-sm">
          {s.access[tab].state === "pending_payment"
            ? "Your payment is pending. This unlocks automatically once it's paid."
            : `This is a full preview with your real photos and details. Purchase to ${tab === "website" ? "publish your website" : "download full-resolution files"}.`}
        </div>
      ) : s.permissions.isBusiness && s.access[tab].state === "locked" ? (
        <div className="shrink-0 border-b border-border bg-white px-4 py-2 text-center text-xs text-muted surface-dark:bg-card">
          Paid add-on ({formatCents(s.access[tab].offer.priceCents)}) — the client hasn&apos;t purchased it yet. You can still prepare it and change the offer on the project page.
        </div>
      ) : null}

      {tab === "social" && hasPhotos ? (
        <SocialWorkspace
          kit={kit}
          view={view}
          thumbItems={thumbItems}
          focusedItem={focusedItem}
          selected={selectedAsset}
          onSelect={setSelectedAsset}
          locked={socialLocked}
          websiteUrl={websiteUrl}
          settingsPanel={socialPanel}
          onOpenSettings={() => setDrawer(true)}
          canDownload={s.permissions.canDownload}
          downloading={downloading}
          onDownload={(it) => void download(it)}
          purchase={
            !s.permissions.canDownload && (s.access.social.state === "locked" || s.access.social.state === "pending_payment")
              ? { label: s.access.social.state === "pending_payment" ? "Complete purchase" : `Unlock · ${formatCents(s.access.social.offer.priceCents)}`, onClick: () => setPurchase("social") }
              : null
          }
        />
      ) : (
      <div className="flex min-h-0 flex-1">
        {/* Desktop panel */}
        <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-r border-border bg-white md:block surface-dark:bg-card">{panel}</aside>

        {/* Preview */}
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {tab === "website" ? (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-border bg-white p-0.5 surface-dark:bg-card" role="group" aria-label="Preview size">
                  <button type="button" onClick={() => setDevice("desktop")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", device === "desktop" ? "bg-slate-900 text-white" : "text-muted")}>
                    <Monitor className="h-3.5 w-3.5" /> Desktop
                  </button>
                  <button type="button" onClick={() => setDevice("mobile")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", device === "mobile" ? "bg-slate-900 text-white" : "text-muted")}>
                    <Smartphone className="h-3.5 w-3.5" /> Mobile
                  </button>
                </div>
                <p className="truncate text-xs text-muted">
                  {s.website.status === "published" ? (s.website.hasUnpublishedChanges ? "Live site shows your last published version" : `Live · ${s.website.viewCount} views`) : "Draft — not public yet"}
                </p>
              </div>
              <div className="min-h-[520px] flex-1">{websitePreview}</div>
            </div>
          ) : (
            <EmptyMedia business={s.permissions.isBusiness} />
          )}
        </main>
      </div>
      )}

      {/* Mobile bottom bar + drawer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden surface-dark:bg-card">
        <Button variant="outline" className="min-h-11 flex-1" onClick={() => setDrawer(true)}>
          <SlidersHorizontal className="h-4 w-4" /> {tab === "social" ? "Kit settings" : "Customize"}
        </Button>
        <div className="flex-[2] [&_a]:min-h-11 [&_button]:min-h-11 [&>div]:justify-end">{tab === "website" ? websiteActions : socialActions}</div>
      </div>
      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Customize">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl bg-white shadow-2xl surface-dark:bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-sm font-semibold">{tab === "website" ? "Customize · Website" : "Kit settings · apply to every graphic"}</p>
              <button type="button" onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">{panel}</div>
            <p className="border-t border-border px-5 py-2 text-center text-[11px] text-muted">{s.permissions.canEdit ? saveText : "View only"}</p>
          </div>
        </div>
      ) : null}

      {/* Tablet / small laptop: kit settings slide over from the left (desktop shows them as a column). */}
      {drawer && tab === "social" ? (
        <div className="fixed inset-0 z-50 hidden md:block xl:hidden" role="dialog" aria-modal="true" aria-label="Kit settings">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[360px] max-w-[90vw] flex-col bg-white pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] shadow-2xl surface-dark:bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-heading">Kit settings</p>
                <p className="text-[11px] text-muted">Apply to every graphic</p>
              </div>
              <button type="button" onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{socialPanel}</div>
            <p className="border-t border-border px-5 py-2 text-center text-[11px] text-muted">{s.permissions.canEdit ? saveText : "View only"}</p>
          </div>
        </div>
      ) : null}
      {purchase !== false ? <PurchaseDialog kit={kit} open onClose={() => setPurchase(false)} preselect={purchase} /> : null}
      <MarketingCheckoutResume kit={kit} />
      <Modal
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title="Publish as included?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmPublish(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => void publish()}>
              Include &amp; publish
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          The Property Website is a paid add-on on this project and the client hasn&apos;t purchased it. Publishing now includes it at no charge for this project. You can also
          bill the client from the project page instead.
        </p>
      </Modal>
    </div>
  );
}

function EmptyMedia({ business }: { business: boolean }) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center surface-dark:bg-card">
      <div className="max-w-sm">
        <Sparkles className="mx-auto h-8 w-8 text-accent" />
        <p className="mt-3 text-lg font-semibold text-heading">Your Marketing Kit builds itself from the project&apos;s photos</p>
        <p className="mt-2 text-sm text-muted">
          {business
            ? "Upload photos to the project (and make sure clients can see them). The website and graphics appear here automatically."
            : "Your photos aren't ready yet. As soon as they're delivered, your website and graphics appear here."}
        </p>
      </div>
    </div>
  );
}

function WebsiteAddress({ kit }: { kit: KitApi }) {
  const s = kit.state;
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(s.website.slug);
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 surface-dark:bg-subtle">
        <p className="text-[11px] uppercase tracking-wider text-muted">{s.website.brandedUrl ? "Your branded address" : "ShootPortal address"}</p>
        <p className="break-all font-medium text-heading">{s.website.liveUrl}</p>
        {s.website.brandedUrl ? <p className="mt-1 break-all text-[11px] text-muted">Also works: {s.website.fallbackUrl}</p> : null}
      </div>
      {s.permissions.isBusiness && s.permissions.canEdit ? (
        editing ? (
          <div className="space-y-2">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              className="flex h-10 w-full rounded-lg border border-border px-3 text-sm"
              aria-label="Website link"
            />
            {s.website.status === "published" ? <p className="text-[11px] text-amber-700">The old link stops working once you change this.</p> : null}
            <div className="flex gap-2">
              <Button size="sm" variant="accent" disabled={kit.busy === "set_slug"} onClick={async () => { const ok = await kit.action("set_slug", { slug }, "Link updated"); if (ok) setEditing(false); }}>
                Save link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSlug(s.website.slug); setEditing(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => setEditing(true)}>
            Edit link ending (/{s.website.slug})
          </button>
        )
      ) : null}
      {s.website.status === "published" && (s.permissions.isBusiness ? s.permissions.canPublish : s.permissions.canPublish) ? (
        <Button size="sm" variant="outline" className="w-full text-red-600" disabled={kit.busy === "unpublish"} onClick={() => void kit.action("unpublish", {}, "Website unpublished — the link is offline.")}>
          Unpublish website
        </Button>
      ) : null}
      {s.permissions.isBusiness && !s.listingDomain.connected ? (
        <p className="text-[11px] text-muted">
          Want listings.yourbusiness.com?{" "}
          <Link className="text-accent hover:underline" href={`/admin/settings?return=${encodeURIComponent(`/admin/projects/${s.projectId}/marketing`)}#settings-listing-domain`}>
            Set up your property website address
          </Link>
        </p>
      ) : null}
    </div>
  );
}
