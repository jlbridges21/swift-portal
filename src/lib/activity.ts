import { createServiceClient } from "@/lib/supabase/server";

export async function logProjectActivity(
  activityType: string,
  description: string,
  options?: {
    projectId?: string;
    leadId?: string;
    userId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("activity_logs").insert({
      activity_type: activityType,
      description,
      user_id: options?.userId ?? null,
      project_id: options?.projectId ?? null,
      lead_id: options?.leadId ?? null,
      metadata: options?.metadata ?? null,
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
