/**
 * Marketing Kit — business settings, per-project offer overrides and access (pure).
 *
 * Business default (Settings → Marketing Kit) → optional project override → access.
 * A granting purchase (paid or comped) always wins: later price or availability changes
 * never revoke access a client already has.
 */
import type { DesignStyle, MarketingProduct } from "@/lib/marketing/model";
import { DESIGN_STYLES } from "@/lib/marketing/model";

export type OfferMode = "included" | "paid" | "unavailable";

export interface ProductSettings {
  /** The business offers this product at all. */
  offered: boolean;
  /** Included at no charge, or sold as a paid add-on. */
  mode: "included" | "paid";
  priceCents: number;
}

export interface MarketingKitSettings {
  website: ProductSettings;
  social: ProductSettings;
  /** Price when a client buys both together. null = sum of the two. */
  bundlePriceCents: number | null;
  /** Show the Marketing Kit (offers, previews) to clients in the portal. */
  showToClients: boolean;
  /** Clients may edit property details, design and branding. */
  clientCanEdit: boolean;
  /** Clients may publish/unpublish their property website once they have access. */
  clientCanPublish: boolean;
  /** Clients may add an add-on to their project invoice and pay later. */
  allowAddToInvoice: boolean;
  defaultTemplate: DesignStyle;
  photographerCredit: boolean;
  /** Default for new property websites: "Powered by ShootPortal" footer credit. */
  poweredBy: boolean;
}

export const DEFAULT_MARKETING_KIT_SETTINGS: MarketingKitSettings = {
  website: { offered: true, mode: "paid", priceCents: 4900 },
  social: { offered: true, mode: "paid", priceCents: 2900 },
  bundlePriceCents: null,
  // Off until the business turns it on, so clients never see a surprise offer.
  showToClients: false,
  clientCanEdit: true,
  clientCanPublish: true,
  allowAddToInvoice: true,
  defaultTemplate: "modern",
  photographerCredit: true,
  poweredBy: true,
};

const MAX_PRICE_CENTS = 1_000_000;
const MIN_PAID_CENTS = 100;

function cents(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(MAX_PRICE_CENTS, Math.max(0, Math.round(v)));
}

function product(raw: unknown, fallback: ProductSettings): ProductSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode = r.mode === "included" || r.mode === "paid" ? r.mode : fallback.mode;
  const price = cents(r.priceCents, fallback.priceCents);
  return {
    offered: typeof r.offered === "boolean" ? r.offered : fallback.offered,
    mode,
    priceCents: mode === "paid" ? Math.max(MIN_PAID_CENTS, price) : price,
  };
}

export function mergeMarketingKitSettings(raw: unknown): MarketingKitSettings {
  const d = DEFAULT_MARKETING_KIT_SETTINGS;
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bundle = r.bundlePriceCents === null || r.bundlePriceCents === undefined ? null : cents(r.bundlePriceCents, 0) || null;
  return {
    website: product(r.website, d.website),
    social: product(r.social, d.social),
    bundlePriceCents: bundle && bundle >= MIN_PAID_CENTS ? bundle : null,
    showToClients: typeof r.showToClients === "boolean" ? r.showToClients : d.showToClients,
    clientCanEdit: typeof r.clientCanEdit === "boolean" ? r.clientCanEdit : d.clientCanEdit,
    clientCanPublish: typeof r.clientCanPublish === "boolean" ? r.clientCanPublish : d.clientCanPublish,
    allowAddToInvoice: typeof r.allowAddToInvoice === "boolean" ? r.allowAddToInvoice : d.allowAddToInvoice,
    defaultTemplate: DESIGN_STYLES.includes(r.defaultTemplate as DesignStyle) ? (r.defaultTemplate as DesignStyle) : d.defaultTemplate,
    photographerCredit: typeof r.photographerCredit === "boolean" ? r.photographerCredit : d.photographerCredit,
    poweredBy: typeof r.poweredBy === "boolean" ? r.poweredBy : d.poweredBy,
  };
}

export type ProjectOfferOverride = { mode: OfferMode; priceCents?: number };
export type ProjectOfferOverrides = Partial<Record<MarketingProduct, ProjectOfferOverride>>;

export function sanitizeOfferOverrides(raw: unknown): ProjectOfferOverrides {
  const out: ProjectOfferOverrides = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["website", "social"] as const) {
    const v = (raw as Record<string, unknown>)[key];
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (o.mode !== "included" && o.mode !== "paid" && o.mode !== "unavailable") continue;
    out[key] = o.mode === "paid" ? { mode: "paid", priceCents: Math.max(MIN_PAID_CENTS, cents(o.priceCents, 0)) } : { mode: o.mode };
  }
  return out;
}

export type ResolvedOffer = {
  mode: OfferMode;
  priceCents: number;
  /** "project" when this project overrides the business default. */
  source: "default" | "project";
};

export function resolveOffer(product: MarketingProduct, settings: MarketingKitSettings, overrides: ProjectOfferOverrides): ResolvedOffer {
  const o = overrides[product];
  if (o) {
    return {
      mode: o.mode,
      priceCents: o.mode === "paid" ? (o.priceCents ?? settings[product].priceCents) : 0,
      source: "project",
    };
  }
  const s = settings[product];
  if (!s.offered) return { mode: "unavailable", priceCents: 0, source: "default" };
  return { mode: s.mode, priceCents: s.mode === "paid" ? s.priceCents : 0, source: "default" };
}

export type PurchaseRow = {
  id: string;
  product: MarketingProduct;
  status: "pending" | "paid" | "comped" | "refunded" | "disputed" | "cancelled";
  amount_cents: number;
  payment_id: string | null;
  purchase_method: "pay_now" | "add_to_invoice" | "business" | null;
  granted_at: string | null;
  created_at: string;
};

export type AccessState =
  | "included" // offered at no charge
  | "purchased" // paid or comped purchase on record
  | "locked" // paid add-on, not purchased
  | "pending_payment" // a payment for it exists but isn't paid
  | "unavailable"; // not offered on this project

export type ProductAccess = {
  product: MarketingProduct;
  state: AccessState;
  hasAccess: boolean;
  offer: ResolvedOffer;
  purchase: PurchaseRow | null;
  pendingPaymentId: string | null;
};

export function resolveAccess(
  product: MarketingProduct,
  offer: ResolvedOffer,
  purchases: PurchaseRow[]
): ProductAccess {
  const mine = purchases.filter((p) => p.product === product);
  const granted = mine.find((p) => p.status === "paid" || p.status === "comped") ?? null;
  if (granted) return { product, state: "purchased", hasAccess: true, offer, purchase: granted, pendingPaymentId: null };
  if (offer.mode === "included") return { product, state: "included", hasAccess: true, offer, purchase: null, pendingPaymentId: null };
  if (offer.mode === "unavailable") return { product, state: "unavailable", hasAccess: false, offer, purchase: null, pendingPaymentId: null };
  const pending = mine.find((p) => p.status === "pending" && p.payment_id) ?? null;
  if (pending) {
    return { product, state: "pending_payment", hasAccess: false, offer, purchase: pending, pendingPaymentId: pending.payment_id };
  }
  return { product, state: "locked", hasAccess: false, offer, purchase: null, pendingPaymentId: null };
}

/** Server-side price for a purchase of one or both products. */
export function purchasePriceCents(products: MarketingProduct[], offers: Record<MarketingProduct, ResolvedOffer>, settings: MarketingKitSettings): number {
  const sum = products.reduce((s, p) => s + offers[p].priceCents, 0);
  const bothDefault = products.length === 2 && offers.website.source === "default" && offers.social.source === "default";
  if (bothDefault && settings.bundlePriceCents && settings.bundlePriceCents < sum) return settings.bundlePriceCents;
  return sum;
}

export function formatCents(c: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
  }).format(c / 100);
}
