/**
 * Marketing Kit purchases — built on the existing `payments` rows.
 *
 * A purchase is a normal project payment (same Stripe Connect checkout, receipts, platform
 * fee behavior, reconciliation and admin "mark paid") plus a `marketing_kit_purchases` row
 * linking it to the product(s). Access is granted only when that payment becomes `paid`
 * (handlePaymentSuccess → grantPurchasesForPayment), or when the business explicitly
 * includes the product. An unpaid "Add to invoice" row grants nothing.
 *
 * Add-on payments never drive project status automation: paying $49 for a website must not
 * move a project to Delivered or unlock downloads that the main invoice controls.
 */
import { logProjectActivity } from "@/lib/activity";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getStripeForBusiness, StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { MarketingError, unpublishWebsite, type KitContext, type MarketingActor } from "@/lib/marketing/server";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, purchasePriceCents } from "@/lib/marketing/offers";

/** True when this payment pays for a Marketing Kit add-on. Never throws (pre-migration safe). */
export async function isMarketingAddonPayment(businessId: string, paymentId: string): Promise<boolean> {
  try {
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db.from("marketing_kit_purchases").select("id").eq("payment_id", paymentId).limit(1);
    if (error) return false;
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

/** Idempotent: pending purchases on this payment become paid. Returns products newly granted. */
export async function grantPurchasesForPayment(businessId: string, paymentId: string): Promise<MarketingProduct[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("marketing_kit_purchases")
    .select("id, product, project_id")
    .eq("payment_id", paymentId)
    .eq("status", "pending");
  if (error || !data?.length) return [];
  const granted: MarketingProduct[] = [];
  const now = new Date().toISOString();
  for (const row of data as { id: string; product: MarketingProduct; project_id: string }[]) {
    const { error: upErr } = await db
      .from("marketing_kit_purchases")
      .update({ status: "paid", granted_at: now, updated_at: now })
      .eq("id", row.id)
      .eq("status", "pending");
    if (!upErr) {
      granted.push(row.product);
      continue;
    }
    if (upErr.code === "23505") {
      // Already granted by another row (e.g. the business included it meanwhile). Keep the
      // payment record; this row stays as a paid duplicate for the business to refund.
      await db
        .from("marketing_kit_purchases")
        .update({ status: "cancelled", revoked_at: now, revoked_reason: "already_granted_paid_duplicate", updated_at: now })
        .eq("id", row.id);
      console.warn("[marketing] payment paid for a product that was already granted", { businessId, paymentId, product: row.product });
    } else {
      console.error("[marketing] grant failed", { businessId, paymentId, message: upErr.message });
    }
  }
  if (granted.length) {
    const projectId = (data[0] as { project_id: string }).project_id;
    await logProjectActivity("marketing_addon_purchased", `Purchased: ${granted.map((p) => PRODUCT_LABEL[p]).join(" + ")}`, {
      businessId,
      projectId,
      visibility: "both",
      idempotencyKey: `marketing:granted:${paymentId}`,
      metadata: { paymentId, products: granted },
    });
  }
  return granted;
}

/**
 * Refund or dispute on an add-on payment: revoke the paid purchases it granted and take the
 * website offline if nothing else grants it. Idempotent.
 */
export async function revokePurchasesForPayment(
  businessId: string,
  paymentId: string,
  reason: "refunded" | "disputed"
): Promise<MarketingProduct[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("marketing_kit_purchases")
    .select("id, product, project_id")
    .eq("payment_id", paymentId)
    .eq("status", "paid");
  if (error || !data?.length) return [];
  const now = new Date().toISOString();
  const rows = data as { id: string; product: MarketingProduct; project_id: string }[];
  await db
    .from("marketing_kit_purchases")
    .update({ status: reason, revoked_at: now, revoked_reason: `stripe_${reason}`, updated_at: now })
    .in("id", rows.map((r) => r.id));
  const products = rows.map((r) => r.product);
  const projectId = rows[0]!.project_id;
  if (products.includes("website")) {
    const { loadKitContext } = await import("@/lib/marketing/server");
    const ctx = await loadKitContext(businessId, projectId).catch(() => null);
    if (ctx && !ctx.access.website.hasAccess && ctx.kit.website_status === "published") {
      await unpublishWebsite(ctx, null, `Property website taken offline — payment ${reason}`);
    }
  }
  await logProjectActivity("marketing_addon_purchased", `Marketing Kit access removed (payment ${reason}): ${products.map((p) => PRODUCT_LABEL[p]).join(" + ")}`, {
    businessId,
    projectId,
    visibility: "admin",
    idempotencyKey: `marketing:revoked:${paymentId}:${reason}`,
    metadata: { paymentId, products, reason },
  });
  return products;
}

/** Record an explicit business inclusion (no charge). Idempotent per product. */
export async function compProduct(ctx: KitContext, actor: MarketingActor, product: MarketingProduct, method: "business" = "business"): Promise<void> {
  if (ctx.access[product].state === "purchased") return;
  const now = new Date().toISOString();
  const { error } = await ctx.db.from("marketing_kit_purchases").insert({
    project_id: ctx.project.id,
    client_id: ctx.project.client_id,
    product,
    status: "comped",
    amount_cents: 0,
    purchase_method: method,
    created_by: actor.profile.id,
    granted_at: now,
  });
  if (error && error.code !== "23505") throw new MarketingError(error.message, 500);
  // An open add-on payment for the same product is no longer needed.
  const pending = ctx.purchases.filter((p) => p.product === product && p.status === "pending");
  if (pending.length) {
    await ctx.db
      .from("marketing_kit_purchases")
      .update({ status: "cancelled", revoked_at: now, revoked_reason: "included_by_business", updated_at: now })
      .in("id", pending.map((p) => p.id));
  }
  const { loadPurchases } = await import("@/lib/marketing/server");
  const { resolveAccess } = await import("@/lib/marketing/offers");
  ctx.purchases = await loadPurchases(ctx.db, ctx.project.id);
  ctx.access[product] = resolveAccess(product, ctx.offers[product], ctx.purchases);
}

/**
 * Before publishing: make access durable. Included products get a comped row so a later
 * switch to "Paid" never takes a live site down. A business publishing a paid website the
 * client hasn't bought is an explicit inclusion. Clients need access first.
 */
export async function ensureGrantForPublish(ctx: KitContext, actor: MarketingActor): Promise<void> {
  const a = ctx.access.website;
  if (a.state === "purchased") return;
  if (a.state === "included") return compProduct(ctx, actor, "website");
  if (actor.kind === "business") {
    if (a.state === "unavailable") {
      throw new MarketingError("The Property Website isn't offered on this project. Change it under Client offer first.");
    }
    return compProduct(ctx, actor, "website");
  }
  throw new MarketingError(
    a.state === "pending_payment"
      ? "Your payment for the Property Website hasn't completed yet. You can publish as soon as it does."
      : "Purchase the Property Website to publish it.",
    402
  );
}

/**
 * Create the add-on payment (Pay now or Add to invoice). Price is computed here from the
 * business default / project override — the browser never sends an amount.
 */
export async function createAddonPayment(
  ctx: KitContext,
  actor: MarketingActor,
  productsRaw: unknown,
  methodRaw: unknown
): Promise<{ paymentId: string; amountCents: number; reused: boolean }> {
  const products = Array.from(
    new Set(Array.isArray(productsRaw) ? productsRaw.filter((p): p is MarketingProduct => p === "website" || p === "social") : [])
  ).sort() as MarketingProduct[];
  if (!products.length) throw new MarketingError("Choose what to purchase.");
  const method = methodRaw === "add_to_invoice" ? "add_to_invoice" : "pay_now";
  if (actor.kind === "client" && method === "add_to_invoice" && !ctx.settings.allowAddToInvoice) {
    throw new MarketingError("Adding to your invoice isn't available — please pay now.");
  }
  if (actor.kind === "business" && !actor.canManageOffers) throw new MarketingError("You don't have permission to bill clients.", 403);
  if (!ctx.project.client_id) throw new MarketingError("This project has no client to bill.");

  for (const p of products) {
    const a = ctx.access[p];
    if (a.hasAccess) throw new MarketingError(`${PRODUCT_LABEL[p]} is already ${a.state === "included" ? "included" : "purchased"}.`, 409);
    if (a.state === "unavailable") throw new MarketingError(`${PRODUCT_LABEL[p]} isn't offered on this project.`, 400);
  }

  // Reuse an open payment that already covers exactly these products.
  const pendingIds = products.map((p) => ctx.access[p].pendingPaymentId);
  if (pendingIds.every((id) => id && id === pendingIds[0])) {
    const id = pendingIds[0]!;
    const { data: pay } = await ctx.db.from("payments").select("id, amount, status").eq("id", id).maybeSingle();
    if (pay && (pay.status === "pending" || pay.status === "sent")) {
      if (method === "add_to_invoice" && pay.status === "pending") {
        await ctx.db.from("payments").update({ status: "sent" }).eq("id", id).eq("status", "pending");
      }
      return { paymentId: id, amountCents: pay.amount as number, reused: true };
    }
  }
  // Different combination than an open payment: close the old open purchase rows first.
  const openRows = ctx.purchases.filter((r) => products.includes(r.product) && r.status === "pending");
  if (openRows.length) {
    const now = new Date().toISOString();
    await ctx.db
      .from("marketing_kit_purchases")
      .update({ status: "cancelled", revoked_at: now, revoked_reason: "replaced", updated_at: now })
      .in("id", openRows.map((r) => r.id));
    const orphanPayments = Array.from(new Set(openRows.map((r) => r.payment_id).filter((x): x is string => Boolean(x))));
    for (const pid of orphanPayments) {
      const { data: others } = await ctx.db.from("marketing_kit_purchases").select("id").eq("payment_id", pid).eq("status", "pending").limit(1);
      if (!others?.length) {
        await ctx.db.from("payments").update({ status: "cancelled" }).eq("id", pid).in("status", ["pending", "sent"]);
      }
    }
  }

  const amount = purchasePriceCents(products, ctx.offers, ctx.settings);
  if (!Number.isInteger(amount) || amount < 100) throw new MarketingError("This add-on doesn't have a valid price.", 400);

  let stripeAccountId: string | null = null;
  try {
    stripeAccountId = (await getStripeForBusiness(ctx.businessId)).stripeAccountId ?? null;
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) {
      if (method === "pay_now") {
        throw new MarketingError("Online payments aren't set up for this business yet. Choose Add to invoice, or ask them to include it.", 400);
      }
    } else throw err;
  }

  const address = ctx.content.property.address || ctx.project.property_address || "your listing";
  const label = products.length === 2 ? `${PRODUCT_LABEL.website} + ${PRODUCT_LABEL.social}` : PRODUCT_LABEL[products[0]!];
  const due = new Date();
  due.setDate(due.getDate() + ctx.appSettings.workflow.businessDefaults.defaultPaymentDueDays);

  const { data: payment, error } = await ctx.db
    .from("payments")
    .insert({
      project_id: ctx.project.id,
      client_id: ctx.project.client_id,
      amount,
      description: `${label} — ${address}`.slice(0, 250),
      due_date: due.toISOString().split("T")[0],
      status: method === "pay_now" ? "pending" : "sent",
      stripe_account_id: stripeAccountId,
    })
    .select("id")
    .single();
  if (error || !payment) throw new MarketingError(error?.message || "Could not create the payment.", 500);

  const { error: purchaseError } = await ctx.db.from("marketing_kit_purchases").insert(
    products.map((p) => ({
      project_id: ctx.project.id,
      client_id: ctx.project.client_id,
      product: p,
      status: "pending",
      amount_cents: products.length === 1 ? amount : ctx.offers[p].priceCents,
      payment_id: payment.id,
      purchase_method: actor.kind === "business" ? "business" : method,
      created_by: actor.profile.id,
    }))
  );
  if (purchaseError) {
    await ctx.db.from("payments").delete().eq("id", payment.id);
    throw new MarketingError(
      purchaseError.code === "23505" ? "A payment for this add-on is already open. Refresh and try again." : purchaseError.message,
      409
    );
  }

  await logProjectActivity(
    "invoice_sent",
    method === "add_to_invoice" || actor.kind === "business"
      ? `${label} added to the project invoice (${formatCents(amount)})`
      : `Checkout started for ${label} (${formatCents(amount)})`,
    {
      businessId: ctx.businessId,
      projectId: ctx.project.id,
      userId: actor.profile.id,
      visibility: "both",
      metadata: { paymentId: payment.id, products, marketing: true },
    }
  );

  return { paymentId: payment.id as string, amountCents: amount, reused: false };
}
