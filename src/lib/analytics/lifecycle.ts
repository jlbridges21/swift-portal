import { createServiceClient } from "@/lib/supabase/server";

/**
 * Billing history the businesses table does not keep (it only holds the current
 * status). Written by the platform billing webhook AFTER its own processing; deduped
 * by Stripe event id; never throws, so it cannot affect billing.
 */
export async function recordBusinessLifecycleEvent(input: {
  businessId: string;
  eventType: "subscription_canceled" | "payment_failed";
  occurredAt: Date;
  stripeEventId: string;
  amountCents?: number | null;
  livemode: boolean;
}): Promise<void> {
  try {
    const db = await createServiceClient();
    const { error } = await db.from("business_lifecycle_events").upsert(
      {
        business_id: input.businessId,
        event_type: input.eventType,
        occurred_at: input.occurredAt.toISOString(),
        stripe_event_id: input.stripeEventId,
        amount_cents: input.amountCents ?? null,
        stripe_mode: input.livemode ? "live" : "test",
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true }
    );
    if (error) console.warn("[analytics] lifecycle event insert failed", error.message);
  } catch (err) {
    console.warn("[analytics] lifecycle event skipped", err instanceof Error ? err.message : err);
  }
}
