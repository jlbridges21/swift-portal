import { createServiceClient } from "@/lib/supabase/server";

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.warn("[stripe-webhook] processed_stripe_events lookup failed:", error.message);
    return false;
  }

  return !!data;
}

export async function markStripeEventProcessed(eventId: string, eventType: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("processed_stripe_events").upsert(
    { event_id: eventId, event_type: eventType, processed_at: new Date().toISOString() },
    { onConflict: "event_id" }
  );

  if (error) {
    console.error("[stripe-webhook] failed to record processed event:", eventId, error.message);
  }
}
