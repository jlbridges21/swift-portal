import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { sendBrandedEmail } from "@/lib/email";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { MESSAGE_TEMPLATE_DEFINITIONS, buildDefaultWorkflowSettings } from "@/lib/workflow-settings";
import { renderWorkflowTemplate } from "@/lib/workflow-template-render";
import {
  AUTOMATED_EMAIL_BODY_MAX,
  AUTOMATED_EMAIL_SAMPLE_VARS,
  AUTOMATED_EMAIL_SUBJECT_MAX,
  automatedEmailCtaLabel,
} from "@/components/admin/settings-tabs/automated-emails-meta";

/** In-process limit: a few test sends per owner per window. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allowTestSend(key: string): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_PER_WINDOW) return false;
  cur.count += 1;
  return true;
}

/**
 * Send one automated email template, rendered with sample data and the
 * caller's unsaved subject/body, to the signed-in owner only.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  let input: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const tpl = MESSAGE_TEMPLATE_DEFINITIONS.find((t) => t.key === input.key);
  if (!tpl) {
    return NextResponse.json({ error: "Unknown email template." }, { status: 400 });
  }

  const to = profile.email?.trim();
  if (!to) {
    return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  }

  if (!allowTestSend(`${tenant.businessId}:${profile.id}`)) {
    return NextResponse.json(
      { error: "Too many test emails. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const defaults = buildDefaultWorkflowSettings().messages[tpl.key];
  const rawSubject =
    typeof input.subject === "string" && input.subject.trim()
      ? input.subject.slice(0, AUTOMATED_EMAIL_SUBJECT_MAX)
      : defaults.subject;
  const rawBody =
    typeof input.body === "string" && input.body.trim()
      ? input.body.slice(0, AUTOMATED_EMAIL_BODY_MAX)
      : defaults.body;

  const settings = await getAppSettings(tenant.businessId);
  const portalUrl = await getBusinessPortalOriginById(tenant.businessId);
  const vars = {
    ...AUTOMATED_EMAIL_SAMPLE_VARS,
    portal_link: portalUrl,
    portal_name: settings.business.portalName?.trim() || AUTOMATED_EMAIL_SAMPLE_VARS.portal_name,
    business_name: settings.business.businessName?.trim() || AUTOMATED_EMAIL_SAMPLE_VARS.business_name,
  };
  const subject = renderWorkflowTemplate(rawSubject, vars, { workflowKey: tpl.key });
  const body = renderWorkflowTemplate(rawBody, vars, { workflowKey: tpl.key });

  const result = await sendBrandedEmail({
    businessId: tenant.businessId,
    to,
    subject: `[Test] ${subject}`,
    title: subject,
    body,
    secondaryInfo: "This is a test with sample data. Your clients see their own details.",
    ctaLabel: automatedEmailCtaLabel(tpl.key),
    ctaUrl: portalUrl,
    emailType: "test",
    analytics: { emailType: "test" },
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error || result.skipReason || "Could not send the test email." },
      { status: result.skipped ? 503 : 502 }
    );
  }

  return NextResponse.json({ ok: true, to });
}
