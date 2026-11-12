/**
 * Client shopping cart for optional Marketing Kit add-ons.
 *
 * There is no separate cart table: the cart is the client's open add-on purchases — each
 * `marketing_kit_purchases` row in `pending` status whose linked `payments` row is still open
 * (pending / sent). That keeps one source of truth for the cart, the Estimate & Pay page, the
 * banners and the Stripe webhook, which already only grants access when that payment is paid.
 *
 * A cart "group" is one add-on payment row = one Stripe checkout. Items from different projects
 * (or two add-ons started separately on one project) are separate groups with their own checkout;
 * nothing is ever combined into a new charge here.
 *
 * Removing an item never touches required project payments: only payment rows linked to a
 * pending add-on purchase are eligible, and only while they are still open. The row is cancelled
 * (never deleted) after every open Stripe Checkout Session / Payment Link for it is closed; a
 * payment that slips through anyway is flagged by handlePaymentSuccess as unexpected and grants
 * nothing. Paid, processing, refunded and comped records are never changed.
 */
import { logProjectActivity } from "@/lib/activity";
import { getAppSettings } from "@/lib/app-settings";
import { findInFlightStripePayment, retirePaymentCheckouts } from "@/lib/checkout-closure";
import { resolveProfileClientId } from "@/lib/project-access";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { resolveOffer, sanitizeOfferOverrides } from "@/lib/marketing/offers";
import type { Profile } from "@/lib/types";

export type CartItem = {
  purchaseId: string;
  product: MarketingProduct;
  label: string;
  /** Price recorded when the item was added (what the client agreed to). */
  amountCents: number;
  /** Set when the business has since changed the offer for this product. */
  offerNote: string | null;
  /** Business-added invoice items stay until the business removes them. */
  removable: boolean;
  addedBy: "you" | "business";
  addedAt: string;
};

export type CartGroupStatus = "awaiting_checkout" | "checkout_started" | "on_invoice";

export type CartGroup = {
  /** The add-on payment row — one checkout. */
  paymentId: string;
  projectId: string;
  projectName: string;
  projectAddress: string;
  /** Amount the checkout charges (payment.amount; may include a bundle price). */
  totalCents: number;
  bundleSavingsCents: number;
  status: CartGroupStatus;
  items: CartItem[];
};

export type ClientCart = {
  groups: CartGroup[];
  itemCount: number;
  subtotalCents: number;
  removableCount: number;
  projectCount: number;
};

export const EMPTY_CART: ClientCart = { groups: [], itemCount: 0, subtotalCents: 0, removableCount: 0, projectCount: 0 };

export class CartError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type PurchaseDbRow = {
  id: string;
  project_id: string;
  product: MarketingProduct;
  status: string;
  amount_cents: number;
  payment_id: string | null;
  purchase_method: "pay_now" | "add_to_invoice" | "business" | null;
  created_by: string | null;
  created_at: string;
};

type PaymentDbRow = {
  id: string;
  project_id: string;
  client_id: string | null;
  amount: number;
  status: string;
  description: string | null;
  due_date: string | null;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_link_id: string | null;
};

type ProjectDbRow = {
  id: string;
  client_id: string | null;
  project_name: string | null;
  property_address: string | null;
};

const PAYMENT_COLUMNS =
  "id, project_id, client_id, amount, status, description, due_date, stripe_account_id, stripe_checkout_session_id, stripe_payment_link_id";

const isOpen = (status: string) => status === "pending" || status === "sent";

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /marketing_kit_purchases|does not exist/i.test(error.message ?? "");
}

/** Projects this client profile is an assigned client of (primary or project_clients), in this business. */
async function loadClientProjects(
  db: TenantServiceClient,
  clientId: string
): Promise<Map<string, ProjectDbRow & { primary: boolean }>> {
  const out = new Map<string, ProjectDbRow & { primary: boolean }>();
  const { data: own } = await db
    .from("projects")
    .select("id, client_id, project_name, property_address")
    .eq("client_id", clientId)
    .is("deleted_at", null);
  for (const p of (own ?? []) as ProjectDbRow[]) out.set(p.id, { ...p, primary: true });
  const { data: links } = await db.raw.from("project_clients").select("project_id").eq("client_id", clientId);
  const linked = ((links ?? []) as { project_id: string }[]).map((l) => l.project_id).filter((id) => !out.has(id));
  if (linked.length) {
    const { data: more } = await db
      .from("projects")
      .select("id, client_id, project_name, property_address")
      .in("id", linked)
      .is("deleted_at", null);
    for (const p of (more ?? []) as ProjectDbRow[]) out.set(p.id, { ...p, primary: p.client_id === clientId });
  }
  return out;
}

/**
 * The signed-in client's cart in this business. Ownership:
 *   - items the client started themselves (created_by = this profile), and
 *   - items the business added to the invoice of a project where this client is the billed client.
 * A co-client on a shared project never sees (or removes) another contact's items.
 */
export async function loadClientCart(profile: Profile, businessId: string): Promise<ClientCart> {
  if (profile.role !== "client") return EMPTY_CART;
  const clientId = await resolveProfileClientId(profile);
  if (!clientId) return EMPTY_CART;
  const db = await createTenantServiceClient(businessId);
  const projects = await loadClientProjects(db, clientId);
  if (!projects.size) return EMPTY_CART;

  const { data: purchaseData, error } = await db
    .from("marketing_kit_purchases")
    .select("id, project_id, product, status, amount_cents, payment_id, purchase_method, created_by, created_at")
    .in("project_id", Array.from(projects.keys()))
    .eq("status", "pending")
    .not("payment_id", "is", null);
  if (error) {
    if (isSchemaMissing(error)) return EMPTY_CART;
    throw new CartError("Couldn't load your cart.", 500);
  }
  const owned = ((purchaseData ?? []) as PurchaseDbRow[]).filter((r) => {
    const project = projects.get(r.project_id);
    if (!project) return false;
    if (r.created_by === profile.id) return true;
    // Business-added (or legacy rows with no author): the billed client owns them.
    if (r.purchase_method === "business" || !r.created_by) return project.primary;
    return false;
  });
  if (!owned.length) return EMPTY_CART;

  const paymentIds = Array.from(new Set(owned.map((r) => r.payment_id!)));
  const { data: payData } = await db.from("payments").select(PAYMENT_COLUMNS).in("id", paymentIds);
  const payments = new Map(((payData ?? []) as PaymentDbRow[]).map((p) => [p.id, p]));

  // Current offers, to flag a price/availability change since the item was added.
  const settings = (await getAppSettings(businessId)).marketingKit;
  const projectIds = Array.from(new Set(owned.map((r) => r.project_id)));
  const { data: kits } = await db.from("marketing_kits").select("project_id, offer_overrides").in("project_id", projectIds);
  const overridesByProject = new Map(
    ((kits ?? []) as { project_id: string; offer_overrides: unknown }[]).map((k) => [k.project_id, sanitizeOfferOverrides(k.offer_overrides ?? {})])
  );

  const groups = new Map<string, CartGroup>();
  for (const row of owned.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const payment = payments.get(row.payment_id!);
    // Paid / processing / closed payments are not cart items (loadPurchases heals stale rows).
    if (!payment || !isOpen(payment.status) || payment.project_id !== row.project_id) continue;
    const project = projects.get(row.project_id)!;
    const offer = resolveOffer(row.product, settings, overridesByProject.get(row.project_id) ?? {});
    const offerNote =
      offer.mode === "included"
        ? "Now included at no charge — you can remove this."
        : offer.mode === "unavailable"
          ? "No longer offered on this project."
          : offer.priceCents !== row.amount_cents
            ? `Current price is ${formatUsd(offer.priceCents)}. Your cart keeps the price you added it at.`
            : null;
    let group = groups.get(payment.id);
    if (!group) {
      group = {
        paymentId: payment.id,
        projectId: project.id,
        projectName: project.project_name || project.property_address || "Your project",
        projectAddress: project.property_address || "",
        totalCents: payment.amount,
        bundleSavingsCents: 0,
        status:
          row.purchase_method === "business" || payment.status === "sent"
            ? "on_invoice"
            : payment.stripe_checkout_session_id
              ? "checkout_started"
              : "awaiting_checkout",
        items: [],
      };
      groups.set(payment.id, group);
    }
    group.items.push({
      purchaseId: row.id,
      product: row.product,
      label: PRODUCT_LABEL[row.product],
      amountCents: row.amount_cents,
      offerNote,
      removable: row.purchase_method !== "business",
      addedBy: row.purchase_method === "business" ? "business" : "you",
      addedAt: row.created_at,
    });
  }
  const list = Array.from(groups.values());
  for (const g of list) {
    const sum = g.items.reduce((s, i) => s + i.amountCents, 0);
    g.bundleSavingsCents = g.items.length > 1 && sum > g.totalCents ? sum - g.totalCents : 0;
  }
  const items = list.flatMap((g) => g.items);
  return {
    groups: list,
    itemCount: items.length,
    subtotalCents: list.reduce((s, g) => s + g.totalCents, 0),
    removableCount: items.filter((i) => i.removable).length,
    projectCount: new Set(list.map((g) => g.projectId)).size,
  };
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export type RemoveResult = {
  removed: string[];
  /** Items that couldn't be removed, with a client-facing reason. */
  skipped: { purchaseId: string; reason: string }[];
  cart: ClientCart;
};

/**
 * Remove items from the client's cart (`"all"` = every removable item). Only items in this
 * client's own cart are eligible; anything else in the request is ignored. Idempotent.
 */
export async function removeFromCart(
  profile: Profile,
  businessId: string,
  target: string[] | "all"
): Promise<RemoveResult> {
  const cart = await loadClientCart(profile, businessId);
  const wanted = target === "all" ? null : new Set(target);
  const db = await createTenantServiceClient(businessId);
  const removed: string[] = [];
  const skipped: RemoveResult["skipped"] = [];

  for (const group of cart.groups) {
    const targets = group.items.filter((i) => (wanted ? wanted.has(i.purchaseId) : true));
    if (!targets.length) continue;
    const fixed = targets.filter((i) => !i.removable);
    for (const i of fixed) {
      skipped.push({ purchaseId: i.purchaseId, reason: `${i.label} was added by your photographer — message them to remove it.` });
    }
    const removing = targets.filter((i) => i.removable);
    if (!removing.length) continue;
    const skipAll = (reason: string) => removing.forEach((i) => skipped.push({ purchaseId: i.purchaseId, reason }));

    const { data: payData } = await db.from("payments").select(PAYMENT_COLUMNS).eq("id", group.paymentId).maybeSingle();
    const payment = payData as PaymentDbRow | null;
    if (!payment || !isOpen(payment.status)) {
      skipAll("This item was just paid or is being processed.");
      continue;
    }

    // Nothing may still take money for this row once it's removed.
    if (payment.stripe_checkout_session_id || payment.stripe_payment_link_id) {
      let closure: Awaited<ReturnType<typeof retirePaymentCheckouts>>;
      try {
        closure = await retirePaymentCheckouts(payment);
      } catch {
        closure = { allClosed: false, completedSessionId: null };
      }
      if (closure.completedSessionId) {
        skipAll("Your payment for this is being confirmed. Refresh in a moment.");
        continue;
      }
      if (!closure.allClosed) {
        skipAll("We couldn't close your open checkout just now. Please try again in a moment.");
        continue;
      }
      const inFlight = await findInFlightStripePayment(payment).catch(() => null);
      if (inFlight) {
        skipAll("A payment for this is already in progress, so it can't be removed.");
        continue;
      }
    }

    const now = new Date().toISOString();
    const { data: cancelled } = await db
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", payment.id)
      .in("status", ["pending", "sent"])
      .select("id");
    if (!cancelled?.length) {
      skipAll("This item was just paid or is being processed.");
      continue;
    }
    const removingIds = removing.map((i) => i.purchaseId);
    await db
      .from("marketing_kit_purchases")
      .update({ status: "cancelled", revoked_at: now, revoked_reason: "removed_from_cart", updated_at: now })
      .in("id", removingIds)
      .eq("status", "pending");
    removed.push(...removingIds);

    // Part of a combined checkout stays in the cart: move it to its own payment at the price
    // recorded for it (never a new price, never a merged charge).
    const { data: leftData } = await db
      .from("marketing_kit_purchases")
      .select("id, product, amount_cents")
      .eq("payment_id", payment.id)
      .eq("status", "pending");
    const left = (leftData ?? []) as { id: string; product: MarketingProduct; amount_cents: number }[];
    if (left.length) {
      const amount = left.reduce((s, r) => s + r.amount_cents, 0);
      const label = left.map((r) => PRODUCT_LABEL[r.product]).join(" + ");
      const suffix = (payment.description ?? "").split(" — ").slice(1).join(" — ");
      let moved = false;
      if (amount >= 100) {
        const { data: replacement } = await db
          .from("payments")
          .insert({
            project_id: payment.project_id,
            client_id: payment.client_id,
            amount,
            description: (suffix ? `${label} — ${suffix}` : label).slice(0, 250),
            due_date: payment.due_date,
            status: payment.status,
            stripe_account_id: payment.stripe_account_id,
          })
          .select("id")
          .single();
        if (replacement?.id) {
          const { error: moveErr } = await db
            .from("marketing_kit_purchases")
            .update({ payment_id: replacement.id, updated_at: now })
            .in("id", left.map((r) => r.id))
            .eq("status", "pending");
          moved = !moveErr;
          if (!moved) await db.from("payments").update({ status: "cancelled" }).eq("id", replacement.id).in("status", ["pending", "sent"]);
        }
      }
      if (!moved) {
        // Never leave a pending purchase pointing at a cancelled payment.
        await db
          .from("marketing_kit_purchases")
          .update({ status: "cancelled", revoked_at: now, revoked_reason: "payment_closed", updated_at: now })
          .in("id", left.map((r) => r.id))
          .eq("status", "pending");
        removed.push(...left.map((r) => r.id));
      }
    }

    const labels = removing.map((i) => i.label).join(" + ");
    await logProjectActivity("marketing_cart_removed", `Client removed from cart: ${labels} (optional add-on, unpaid)`, {
      businessId,
      projectId: group.projectId,
      userId: profile.id,
      visibility: "admin",
      metadata: { paymentId: payment.id, purchaseIds: removingIds, marketing: true },
    }).catch(() => null);
  }

  return { removed, skipped, cart: await loadClientCart(profile, businessId) };
}
