"use client";

/**
 * New interface Marketing Kit tab: the Property Website and Social Media Kit add-ons for one
 * project. Same API and rules as Classic's MarketingKitCard (`/api/marketing/[projectId]`
 * actions set_offer / include / bill); only the presentation differs. Access is always read from
 * the server's resolved state — the UI never grants anything itself.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Lock,
  Monitor,
  Receipt,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, type ProductAccess } from "@/lib/marketing/offers";
import type { KitSummary } from "@/lib/marketing/server";

type Props = {
  projectId: string;
  projectName: string;
  location: string | null;
  summary: KitSummary;
  canManageOffers: boolean;
  canEdit: boolean;
  previewImageUrl: string | null;
  /** Per-project client visibility (switch shown when a handler is passed). */
  clientVisible?: boolean;
  visibilitySaving?: boolean;
  onClientVisibleChange?: (visible: boolean) => void;
};

type Status = { label: string; tone: string; price: string };

function accessStatus(a: ProductAccess, listPriceCents: number): Status {
  switch (a.state) {
    case "included":
      return { label: "Free Access", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", price: "Unlocked" };
    case "purchased":
      return a.purchase?.status === "comped"
        ? { label: "Free Access", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", price: "Unlocked" }
        : {
            label: "Purchased",
            tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
            price: `Paid · ${formatCents(a.purchase?.amount_cents ?? 0)}`,
          };
    case "pending_payment":
      return {
        label: "Invoiced · unpaid",
        tone: "bg-amber-50 text-amber-800 ring-amber-200",
        price: formatCents(a.purchase?.amount_cents ?? a.offer.priceCents),
      };
    case "locked":
      return { label: "Offered", tone: "bg-blue-50 text-blue-700 ring-blue-200", price: formatCents(listPriceCents) };
    default:
      return { label: "Not offered", tone: "bg-slate-100 text-slate-600 ring-slate-200", price: "—" };
  }
}

function accessNote(a: ProductAccess): { text: string; ok: boolean } {
  switch (a.state) {
    case "included":
      return { text: "Client has access (unlocked for free).", ok: true };
    case "purchased":
      return a.purchase?.status === "comped"
        ? { text: "Client has access (unlocked for free).", ok: true }
        : { text: "Client purchased this add-on and has access.", ok: true };
    case "pending_payment":
      return { text: "On the client's invoice — access unlocks when it's paid.", ok: false };
    case "locked":
      return { text: "Client must purchase to access (unless you unlock it for free).", ok: false };
    default:
      return { text: "Not offered to this client. Turn on Offer to client to make it available.", ok: false };
  }
}

function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

async function postMarketing(projectId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/marketing/${projectId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || "That didn't work");
}

export function MarketingAddOns({
  projectId,
  projectName,
  location,
  summary,
  canManageOffers,
  canEdit,
  previewImageUrl,
  clientVisible,
  visibilitySaving,
  onClientVisibleChange,
}: Props) {
  const editor = `/admin/projects/${projectId}/marketing`;

  if (summary.setupRequired) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
          <Sparkles className="h-5 w-5 text-accent" /> Marketing Kit
        </h2>
        <p className="mt-1 text-sm text-muted">
          Property websites and social graphics need a one-time database update (migration v118). Nothing else is
          affected.
        </p>
      </div>
    );
  }

  const products: MarketingProduct[] = ["website", "social"];
  const listPrice = (p: MarketingProduct) =>
    summary.offerOverrides[p]?.priceCents ?? summary.defaults[p].priceCents ?? summary.access[p].offer.priceCents;

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-xl font-semibold tracking-tight text-heading">Marketing Kit Add-Ons</h2>
          <p className="text-sm text-muted">
            Offer these add-ons to the client, set the price, or unlock them for free for this project.
          </p>
        </div>
        {onClientVisibleChange ? (
          <MarketingVisibilityToggle
            visible={clientVisible ?? summary.visibleToClient}
            saving={visibilitySaving}
            nothingOffered={!summary.anyOffered}
            onChange={onClientVisibleChange}
          />
        ) : summary.visibleToClient ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Visible to client
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 surface-dark:bg-subtle surface-dark:text-muted">
            Hidden from client ·{" "}
            <Link href="/admin/settings#settings-marketing-kit" className="text-accent hover:underline">
              settings
            </Link>
          </span>
        )}
      </div>

      {/* Overview + how it works */}
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm @2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] @2xl:gap-0 @2xl:divide-x @2xl:divide-border @2xl:p-5">
        {/* One shared grid so the badge and price columns line up across rows. */}
        <ul className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 @md:grid-cols-[minmax(0,1fr)_auto_auto] @2xl:pr-6">
          {products.map((p) => {
            const st = accessStatus(summary.access[p], listPrice(p));
            const Icon = p === "website" ? Monitor : Share2;
            return (
              <li
                key={p}
                className="col-span-full grid min-h-12 grid-cols-subgrid items-center gap-x-3 rounded-xl bg-subtle/50 px-3 py-2 surface-dark:bg-subtle/40"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted ring-1 ring-inset ring-border">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm font-medium text-heading">{PRODUCT_LABEL[p]}</span>
                </span>
                <span
                  className={cn(
                    "justify-self-end whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset @md:justify-self-start",
                    st.tone
                  )}
                >
                  {st.label}
                </span>
                <span className="col-span-full whitespace-nowrap text-right text-sm font-semibold tabular-nums text-heading @md:col-span-1 @md:min-w-[4.5rem]">
                  {st.price}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border pt-3 @2xl:border-t-0 @2xl:pl-6 @2xl:pt-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Info className="h-4 w-4 text-muted" /> How It Works
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-9 text-xs text-muted marker:text-accent">
            <li>Client can purchase from their portal.</li>
            <li>Prices can be adjusted until payment is made.</li>
            <li>You can unlock either add-on for free at any time.</li>
            <li>Opening an add-on takes you to its full editor page.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 @4xl:grid-cols-2">
        {products.map((p) => (
          <AddOnCard
            key={p}
            product={p}
            projectId={projectId}
            projectName={projectName}
            location={location}
            summary={summary}
            listPriceCents={listPrice(p)}
            canManageOffers={canManageOffers}
            canEdit={canEdit}
            editorHref={p === "website" ? editor : `${editor}?tab=social`}
            previewImageUrl={previewImageUrl}
          />
        ))}
      </div>

      {!summary.listingDomainConnected ? (
        <p className="text-xs text-muted">
          Websites use your ShootPortal address until you{" "}
          <Link
            href={`/admin/settings?return=${encodeURIComponent(editor)}#settings-listing-domain`}
            className="text-accent hover:underline"
          >
            set up listings.yourbusiness.com
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function AddOnCard({
  product,
  projectId,
  projectName,
  location,
  summary,
  listPriceCents,
  canManageOffers,
  canEdit,
  editorHref,
  previewImageUrl,
}: {
  product: MarketingProduct;
  projectId: string;
  projectName: string;
  location: string | null;
  summary: KitSummary;
  listPriceCents: number;
  canManageOffers: boolean;
  canEdit: boolean;
  editorHref: string;
  previewImageUrl: string | null;
}) {
  const router = useRouter();
  const access = summary.access[product];
  const override = summary.offerOverrides[product];
  const def = summary.defaults[product];
  const st = accessStatus(access, listPriceCents);
  const note = accessNote(access);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [priceText, setPriceText] = useState(() => (listPriceCents / 100).toFixed(2));
  useEffect(() => setPriceText((listPriceCents / 100).toFixed(2)), [listPriceCents]);

  const purchased = access.state === "purchased";
  const comped = purchased && access.purchase?.status === "comped";
  const offered = access.state !== "unavailable";
  const free = access.state === "included" || comped;
  // Price only matters for a paid offer nobody has paid for yet.
  // A pending invoice already carries its price; Unlock for Client (below) settles it instead.
  const pending = access.state === "pending_payment";
  const priceEditable = canManageOffers && offered && !free && !purchased && !pending;
  const parsedPrice = parseDollarsToCents(priceText);
  const priceDirty = parsedPrice !== null && parsedPrice !== listPriceCents;

  async function run(key: string, body: Record<string, unknown>, ok: string) {
    setBusy(key);
    try {
      await postMarketing(projectId, body);
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  function setOffer(offer: Record<string, unknown> | null, ok: string, key = "offer") {
    return run(key, { action: "set_offer", product, offer }, ok);
  }

  function toggleOffered(next: boolean) {
    if (!next) return setOffer({ mode: "unavailable" }, `${PRODUCT_LABEL[product]} no longer offered on this project`);
    // Back on: inherit the business default when it offers the product, else a paid offer at the list price.
    if (def.mode !== "unavailable" && !override) return setOffer(null, "Offered to client");
    return setOffer({ mode: "paid", priceCents: parsedPrice ?? listPriceCents }, "Offered to client");
  }

  function toggleFree(next: boolean) {
    if (next) return setOffer({ mode: "included" }, "Free for this client");
    return setOffer({ mode: "paid", priceCents: parsedPrice ?? listPriceCents }, "Client now purchases this add-on");
  }

  const ws = summary.websiteStatus;
  const isWebsite = product === "website";
  const Icon = isWebsite ? Globe : Share2;
  const controlsDisabled = !canManageOffers || busy !== null;

  return (
    <section className="@container flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid gap-4 p-4 @[30rem]:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] @[30rem]:p-5">
        <AddOnPreview product={product} imageUrl={previewImageUrl} name={projectName} location={location} />
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-heading">
              <Icon className="h-5 w-5 text-accent" />
              {PRODUCT_LABEL[product]}
            </h3>
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", st.tone)}>
              {free || purchased ? <Check className="h-3 w-3" /> : null}
              {free ? "Unlocked" : st.label}
            </span>
            {isWebsite && ws !== "none" ? (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  ws === "published" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600 surface-dark:bg-subtle surface-dark:text-muted"
                )}
              >
                {ws === "published" ? "Published" : ws === "unpublished" ? "Unpublished" : "Draft"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {isWebsite
              ? "A branded, mobile-friendly property website to showcase the listing."
              : "A ready-to-post set of social media assets (posts, stories, a carousel and a print flyer) for the listing."}
          </p>

          <div className="mt-3">
            <label className="sr-only" htmlFor={`addon-price-${product}`}>
              {PRODUCT_LABEL[product]} price
            </label>
            <div className="flex gap-2">
              <div
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center rounded-lg border border-border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-accent",
                  !priceEditable && "bg-subtle text-muted"
                )}
              >
                <span className="mr-1.5 text-muted">$</span>
                <input
                  id={`addon-price-${product}`}
                  inputMode="decimal"
                  value={priceText}
                  disabled={!priceEditable || busy !== null}
                  onChange={(e) => setPriceText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && priceDirty && parsedPrice !== null) {
                      void setOffer({ mode: "paid", priceCents: parsedPrice }, "Price updated", "price");
                    }
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
                />
              </div>
              {priceEditable && priceDirty ? (
                <Button
                  variant="accent"
                  className="h-10"
                  disabled={busy !== null || parsedPrice === null}
                  onClick={() => void setOffer({ mode: "paid", priceCents: parsedPrice! }, "Price updated", "price")}
                >
                  {busy === "price" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
                </Button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">
              {purchased && !comped
                ? "Paid — the price can no longer change."
                : pending
                  ? "On the client's invoice at this price."
                  : free
                  ? "Already unlocked for this client."
                  : !offered
                    ? "Turn on Offer to client to set a price."
                    : "Can be edited until client pays."}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={editorHref} className={cn(buttonVariants({ variant: "accent" }), "h-10 flex-1 justify-center")}>
              <ExternalLink className="h-4 w-4" />
              {isWebsite ? (ws === "none" ? "Create Property Website" : "Open Property Website") : "Open Social Media Kit"}
            </Link>
            {isWebsite && ws === "published" && summary.liveUrl ? (
              <>
                <a
                  href={summary.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "h-10")}
                >
                  View live
                </a>
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(summary.liveUrl!).catch(() => undefined);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  Copy link
                </Button>
              </>
            ) : null}
          </div>
          {!canEdit && isWebsite ? (
            <p className="mt-1 text-xs text-muted">You can preview the website; editing needs project edit permission.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto grid gap-4 border-t border-border bg-subtle/40 p-4 @[30rem]:grid-cols-2 @[30rem]:p-5">
        <div className="space-y-2.5">
          <ToggleRow
            label="Offer to client"
            checked={offered}
            disabled={controlsDisabled || purchased || pending}
            busy={busy === "offer" && !free}
            onChange={(v) => void toggleOffered(v)}
          />
          <ToggleRow
            label="Free for this client"
            checked={free}
            disabled={controlsDisabled || purchased || pending || !offered}
            onChange={(v) => void toggleFree(v)}
          />
          {canManageOffers && override && !purchased ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void setOffer(null, "Using your business default")}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
            >
              Reset to business default
            </button>
          ) : (
            <p className="text-[11px] text-muted">
              {override ? "Set for this project." : "Inherited from Settings → Marketing Kit."}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {access.hasAccess ? (
            <Button variant="accent" className="h-10 w-full" disabled>
              <CheckCircle2 className="h-4 w-4" /> Unlocked
            </Button>
          ) : access.state === "locked" || access.state === "pending_payment" ? (
            <>
              <Button
                variant="accent"
                className="h-10 w-full"
                disabled={controlsDisabled}
                onClick={() => {
                  if (
                    window.confirm(
                      `Unlock ${PRODUCT_LABEL[product]} for free on this project? The client gets access without paying.`
                    )
                  ) {
                    void run("include", { action: "include", product }, "Unlocked for the client at no charge");
                  }
                }}
              >
                {busy === "include" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Unlock for Client
              </Button>
              {access.state === "locked" && canManageOffers ? (
                <Button
                  variant="outline"
                  className="h-9 w-full"
                  disabled={controlsDisabled}
                  onClick={() => void run("bill", { action: "bill", products: [product] }, "Added to the client's invoice")}
                >
                  {busy === "bill" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  Add to client&apos;s invoice
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              variant="outline"
              className="h-10 w-full"
              disabled={controlsDisabled}
              onClick={() => void toggleOffered(true)}
            >
              Make Available
            </Button>
          )}
          <p className={cn("flex items-start gap-1.5 text-xs", note.ok ? "text-emerald-700" : "text-muted")}>
            {note.ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" /> : <Lock className="mt-px h-3.5 w-3.5 shrink-0" />}
            {note.text}
          </p>
          {!canManageOffers ? (
            <p className="text-[11px] text-muted">Pricing and unlocks need the “send payment links” permission.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  busy,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={cn("flex items-center gap-2.5 text-sm text-foreground", disabled && "opacity-70")}>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
      {label}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" /> : null}
    </label>
  );
}

/** Device mock-ups built from the project's own cover — no stock imagery. */
function AddOnPreview({
  product,
  imageUrl,
  name,
  location,
}: {
  product: MarketingProduct;
  imageUrl: string | null;
  name: string;
  location: string | null;
}) {
  const image = (className: string) =>
    imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className={cn("h-full w-full object-cover", className)} />
    ) : (
      <div className={cn("h-full w-full bg-gradient-to-br from-slate-300 to-slate-500", className)} />
    );

  if (product === "website") {
    return (
      <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 surface-dark:from-subtle surface-dark:to-card">
        <div className="w-full max-w-[15rem]">
          <div className="rounded-t-lg border-[5px] border-b-0 border-slate-800 bg-slate-800">
            <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-white">
              {image("")}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-2 px-2 text-center text-white">
                <p className="truncate text-[11px] font-semibold leading-tight">{name}</p>
                {location ? <p className="truncate text-[8px] opacity-80">{location}</p> : null}
              </div>
            </div>
          </div>
          <div className="mx-[-6%] h-2 rounded-b-lg bg-gradient-to-b from-slate-300 to-slate-400" />
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 surface-dark:from-subtle surface-dark:to-card">
      <div className="absolute left-3 top-1/2 hidden h-24 w-20 -translate-y-1/2 -rotate-6 overflow-hidden rounded-md border-2 border-white shadow sm:block">
        {image("")}
      </div>
      <div className="absolute right-3 top-1/2 hidden h-24 w-20 -translate-y-1/2 rotate-6 overflow-hidden rounded-md border-2 border-white shadow sm:block">
        {image("scale-125")}
      </div>
      <div className="relative z-10 w-24 rounded-[1.1rem] border-[4px] border-slate-800 bg-slate-800 shadow-lg">
        <div className="aspect-[9/18] overflow-hidden rounded-[0.8rem] bg-white">
          <div className="flex h-4 items-center gap-1 px-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-1 w-8 rounded bg-slate-200" />
          </div>
          <div className="aspect-square">{image("")}</div>
          <div className="space-y-1 p-1.5">
            <span className="block h-1 w-12 rounded bg-slate-200" />
            <span className="block h-1 w-8 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}


/** "Visible to client" switch for the Marketing Kit, matching the portal visibility toggles. */
export function MarketingVisibilityToggle({
  visible,
  saving,
  nothingOffered,
  onChange,
}: {
  visible: boolean;
  saving?: boolean;
  nothingOffered?: boolean;
  onChange: (visible: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex cursor-pointer items-center gap-2.5 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-xs font-medium text-foreground shadow-sm">
        <span className={visible ? "text-emerald-700" : "text-muted"}>
          {visible ? "Visible to client" : "Hidden from client"}
        </span>
        <Switch
          checked={visible}
          disabled={saving}
          onCheckedChange={onChange}
          aria-label={`Marketing Kit ${visible ? "visible to client" : "hidden from client"}`}
          className={cn(saving && "opacity-60")}
        />
      </label>
      {visible && nothingOffered ? (
        <p className="max-w-[15rem] text-right text-[11px] leading-snug text-amber-700">No add-on offered yet — the client sees it once one is.</p>
      ) : null}
    </div>
  );
}
