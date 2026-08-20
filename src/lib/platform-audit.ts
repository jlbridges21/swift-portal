import { createServiceClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type PlatformAuditAction =
  | "business.create"
  | "business.update"
  | "business.suspend"
  | "business.reactivate"
  | "business.soft_delete"
  | "business.hard_delete"
  | "business.plan_change"
  | "admin.invite"
  | "admin.invite_resend"
  | "impersonation.start"
  | "impersonation.stop"
  | "impersonation.allow_writes"
  | "impersonation.request"
  | "plan.create"
  | "plan.update"
  | "plan.activate"
  | "plan.deactivate"
  | "plan.reorder";

export async function requestIpAddress(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function writePlatformAudit(entry: {
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetBusinessId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}): Promise<void> {
  const supabase = await createServiceClient();
  const ip = entry.ipAddress !== undefined ? entry.ipAddress : await requestIpAddress();
  const { error } = await supabase.from("platform_audit_log").insert({
    actor_user_id: entry.actorUserId,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_business_id: entry.targetBusinessId ?? null,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ip_address: ip,
  });
  if (error) {
    console.error("[platform-audit] insert failed:", error.message);
  }
}
