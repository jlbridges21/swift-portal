import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildLifecycleVariables,
  renderLifecyclePreview,
  resolveLifecycleRecipients,
  sendLifecycleTestEmail,
  type LifecycleBusinessRow,
  type PlatformEmailTemplateRow,
} from "@/lib/platform-lifecycle";

async function loadTemplate(id: string): Promise<PlatformEmailTemplateRow | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase.from("platform_email_templates").select("*").eq("id", id).maybeSingle();
  return (data as PlatformEmailTemplateRow | null) ?? null;
}

async function loadBusiness(id: string): Promise<LifecycleBusinessRow | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, status, deleted_at, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, billing_email, lifecycle_emails_suppressed"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as LifecycleBusinessRow | null) ?? null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json()) as {
    action?: "preview" | "test_send";
    businessId?: string;
    to?: string;
    /** Optional draft overrides for preview without saving. */
    subject?: string;
    body?: string;
  };

  const template = await loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (!body.businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  const business = await loadBusiness(body.businessId);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const draft: PlatformEmailTemplateRow = {
    ...template,
    subject: typeof body.subject === "string" ? body.subject : template.subject,
    body: typeof body.body === "string" ? body.body : template.body,
  };

  if (body.action === "preview" || !body.action) {
    const { ownerName } = await resolveLifecycleRecipients(business);
    const variables = await buildLifecycleVariables(business, ownerName);
    const rendered = renderLifecyclePreview(draft, variables);
    return NextResponse.json({ rendered, variables });
  }

  if (body.action === "test_send") {
    const to = body.to?.trim();
    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "Valid to address required" }, { status: 400 });
    }
    const result = await sendLifecycleTestEmail({
      template: draft,
      business,
      to,
      actorUserId: auth.profile.id,
      actorEmail: auth.profile.email,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Test send failed", from: result.from }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      from: result.from,
      subject: result.subject,
      note: "Test send — marked is_test and does not satisfy cron idempotency.",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
