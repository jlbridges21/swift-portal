import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit, requestIpAddress } from "@/lib/platform-audit";

/**
 * Super-admin toggle: suppress ShootPortal lifecycle emails for one business.
 * POST { suppressed: boolean }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json()) as { suppressed?: boolean };
  if (typeof body.suppressed !== "boolean") {
    return NextResponse.json({ error: "suppressed boolean required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: existing, error: loadErr } = await supabase
    .from("businesses")
    .select("id, name, lifecycle_emails_suppressed")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("businesses")
    .update({ lifecycle_emails_suppressed: body.suppressed })
    .eq("id", id)
    .select("id, name, lifecycle_emails_suppressed")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAudit({
    actorUserId: auth.profile.id,
    actorEmail: auth.profile.email,
    action: "lifecycle_email.suppress",
    targetBusinessId: id,
    targetType: "business",
    targetId: id,
    ipAddress: await requestIpAddress(),
    metadata: {
      before: existing.lifecycle_emails_suppressed,
      after: body.suppressed,
      business_name: existing.name,
    },
  });

  return NextResponse.json({ business: updated });
}
