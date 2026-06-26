import { createServiceClient } from "@/lib/supabase/server";

export type CommunicationType =
  | "email"
  | "in_app"
  | "push"
  | "system"
  | "scheduling"
  | "proposal"
  | "revision"
  | "payment";

export type CommunicationStatus =
  | "created"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed";

export async function logCommunication(options: {
  projectId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  commType: CommunicationType;
  direction?: "outbound" | "inbound" | "system";
  title?: string | null;
  message?: string | null;
  status?: CommunicationStatus;
  provider?: "resend" | "onesignal" | "internal" | "stripe" | "system";
  providerEventId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("communications").insert({
      project_id: options.projectId ?? null,
      client_id: options.clientId ?? null,
      user_id: options.userId ?? null,
      comm_type: options.commType,
      direction: options.direction ?? "outbound",
      title: options.title ?? null,
      message: options.message ?? null,
      status: options.status ?? "created",
      provider: options.provider ?? "internal",
      provider_event_id: options.providerEventId ?? null,
      metadata: options.metadata ?? null,
      created_at: options.createdAt,
    });
  } catch (err) {
    console.warn("[communications] log failed:", err);
  }
}
