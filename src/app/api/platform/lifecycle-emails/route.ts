import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAllLifecycleTemplates } from "@/lib/platform-lifecycle";
import { writePlatformAudit, requestIpAddress } from "@/lib/platform-audit";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const templates = await loadAllLifecycleTemplates();
    const supabase = await createServiceClient();
    const { data: counts } = await supabase
      .from("platform_email_sends")
      .select("template_key")
      .eq("is_test", false);

    const sendCounts: Record<string, number> = {};
    for (const row of counts ?? []) {
      sendCounts[row.template_key] = (sendCounts[row.template_key] ?? 0) + 1;
    }

    const { data: recent } = await supabase
      .from("platform_email_sends")
      .select("id, business_id, template_key, event_date, is_test, recipient, subject, created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    const businessIds = [...new Set((recent ?? []).map((r) => r.business_id))];
    const nameById = new Map<string, string>();
    if (businessIds.length) {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, name")
        .in("id", businessIds);
      for (const b of businesses ?? []) nameById.set(b.id, b.name);
    }

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        send_count: sendCounts[t.key] ?? 0,
      })),
      recent: (recent ?? []).map((r) => ({
        ...r,
        business_name: nameById.get(r.business_id) ?? r.business_id,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load lifecycle emails" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      id?: string;
      subject?: string;
      body?: string;
      send_offset_days?: number;
      is_active?: boolean;
      name?: string;
      description?: string | null;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.subject === "string") patch.subject = body.subject;
    if (typeof body.body === "string") patch.body = body.body;
    if (typeof body.name === "string") patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (typeof body.send_offset_days === "number") {
      if (body.send_offset_days < -365 || body.send_offset_days > 365) {
        return NextResponse.json({ error: "send_offset_days out of range" }, { status: 400 });
      }
      patch.send_offset_days = Math.trunc(body.send_offset_days);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: before } = await supabase
      .from("platform_email_templates")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (!before) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from("platform_email_templates")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writePlatformAudit({
      actorUserId: auth.profile.id,
      actorEmail: auth.profile.email,
      action: "lifecycle_email.template_update",
      targetType: "platform_email_template",
      targetId: body.id,
      ipAddress: await requestIpAddress(),
      metadata: { before, after: updated, patch },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 400 }
    );
  }
}
