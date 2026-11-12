import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import type { MarketingProduct } from "@/lib/marketing/model";

/** payment id → the Marketing Kit add-ons that payment row was created for. */
export type MarketingPaymentLinks = Record<string, MarketingProduct[]>;

/**
 * Which payment rows are optional Marketing Kit add-on charges. Every add-on purchase (Pay now
 * or Add to invoice) creates its own payments row and records it on marketing_kit_purchases.
 * payment_id, so this link — not the invoice description — is what classifies a charge.
 * Any purchase status counts: the payment row is still an add-on charge even if the purchase was
 * later replaced or cancelled. Read-only; fails safe to "no add-on payments" (missing tables,
 * query errors), which keeps the previous required-payment presentation.
 */
export async function loadMarketingPaymentLinks(businessId: string, projectIds: string[]): Promise<MarketingPaymentLinks> {
  if (!projectIds.length) return {};
  try {
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db
      .from("marketing_kit_purchases")
      .select("payment_id, product")
      .in("project_id", projectIds)
      .not("payment_id", "is", null);
    if (error) return {};
    const out: MarketingPaymentLinks = {};
    for (const row of data ?? []) {
      const id = row.payment_id as string | null;
      const product = row.product as MarketingProduct;
      if (!id || (product !== "website" && product !== "social")) continue;
      const list = (out[id] ??= []);
      if (!list.includes(product)) list.push(product);
    }
    for (const list of Object.values(out)) list.sort();
    return out;
  } catch {
    return {};
  }
}
