import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { setProjectStatus, setProjectStatusForward } from "@/lib/status-automation";
import { getAppSettings, addProposalExpiration } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { notifyAdmins } from "@/lib/notifications";
import { archivePreviousOfficialQuotes } from "@/lib/quote-archive";
import { canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { ensureApprovalPayment } from "@/lib/approval-payment";
import {
  depositTermColumns,
  parseExplicitDepositTerms,
  quoteCollectsPaymentOnApproval,
} from "@/lib/payment-quote";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";
import { withManualTravelLine } from "@/lib/travel-fee";
import type { AppSettings } from "@/lib/app-settings";
import type { ProjectQuote } from "@/lib/types";
import { notesWithoutArchiveMarker, safeTimeZone } from "@/lib/estimate-pdf";
import {
  archiveSentProposalPdf,
  emailProposalToClients,
  ensureProposalPdf,
  renderProposalPdf,
  type ProposalDelivery,
} from "@/lib/proposal-delivery";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LATER_TERMS_UNAVAILABLE =
  "\"Nothing yet — invoice later\" isn't available on this account yet. Choose another payment option.";

const PDF_FAILED_MESSAGE =
  "The proposal PDF couldn't be generated, so nothing was sent. Try again in a moment.";

type PreparedPdf = { bytes: Uint8Array };

/**
 * Render the exact PDF for a proposal that is about to be sent. Runs before
 * any status change so a PDF failure sends nothing. Archiving happens in
 * deliverProposal, after the row is committed, so a duplicate or losing
 * concurrent request never leaves an orphaned file.
 */
async function prepareSendPdf(
  businessId: string,
  candidate: ProjectQuote,
  appSettings: AppSettings,
  timeZone: string | null
): Promise<{ ok: true; pdf: PreparedPdf; projectName: string } | { ok: false }> {
  try {
    const { bytes, context } = await renderProposalPdf({ businessId, quote: candidate, appSettings, timeZone });
    return { ok: true, pdf: { bytes }, projectName: context.projectName };
  } catch (error) {
    console.error("[quotes] proposal PDF render failed", { quoteId: candidate.id, error });
    return { ok: false };
  }
}

/** Archive (write-once, retried) and email in parallel. `quote` is the committed row. */
async function deliverProposal(args: {
  businessId: string;
  quote: ProjectQuote;
  appSettings: AppSettings;
  pdf: PreparedPdf;
  projectName: string;
  title: string;
  fallbackBody?: string;
}): Promise<ProposalDelivery> {
  const archive = createTenantServiceClient(args.businessId)
    .then((db) => archiveSentProposalPdf(db, args.quote, args.pdf.bytes))
    .catch((error: unknown) => {
      console.error("[quotes] proposal PDF archive threw", { quoteId: args.quote.id, error });
      return { stored: false, error: error instanceof Error ? error.message : String(error) };
    });
  const [store, email] = await Promise.all([
    archive,
    emailProposalToClients({
      businessId: args.businessId,
      quote: args.quote,
      appSettings: args.appSettings,
      pdfBytes: args.pdf.bytes,
      projectName: args.projectName,
      title: args.title,
      fallbackBody: args.fallbackBody,
    }),
  ]);
  if (!store.stored) {
    console.error("[quotes] proposal sent but PDF archive failed; downloads will archive it later", {
      quoteId: args.quote.id,
      projectId: args.quote.project_id,
      error: store.error,
    });
  }
  return {
    pdf: { attached: true, stored: store.stored, error: store.error },
    email,
  };
}

function manualTravelLineItems(
  lineItems: { description: string; amount_cents: number }[],
  body: { travel_one_way_miles?: unknown },
  settings: AppSettings
): { lineItems: { description: string; amount_cents: number }[]; oneWayMiles: number | null | undefined } {
  if (!Object.prototype.hasOwnProperty.call(body, "travel_one_way_miles")) {
    return { lineItems, oneWayMiles: undefined };
  }
  if (!settings.travel.enabled || settings.travel.distanceMode !== "manual") {
    return { lineItems, oneWayMiles: undefined };
  }
  const raw = body.travel_one_way_miles;
  const miles = raw == null || raw === "" ? null : Number(raw);
  const applied = withManualTravelLine(
    lineItems,
    miles != null && Number.isFinite(miles) && miles >= 0 ? miles : null,
    settings.travel
  );
  return { lineItems: applied.lineItems, oneWayMiles: applied.oneWayMiles };
}

function depositColumnsForQuote(
  body: { deposit_mode?: unknown; deposit_percent?: unknown; deposit_amount_cents?: unknown },
  payments: Pick<PaymentAutomationSettings, "depositMode" | "depositPercent" | "depositAmountCents">
) {
  return depositTermColumns(
    parseExplicitDepositTerms(body) ?? {
      depositMode: payments.depositMode,
      depositPercent: payments.depositPercent,
      depositAmountCents: payments.depositAmountCents,
    }
  );
}

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const tenant = await getTenantContext();
  const bid = tenant?.businessId ?? profile.business_id;
  if (!bid) {
    if (profile.role === "super_admin") return missingTenantResponse(profile.role);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (tenant?.isSharedViewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await canAccessProjectAsAssignedClientOrAdmin(profile, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (profile.role === "staff" && !staffCan(profile, "money.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const query = supabase
    .from("project_quotes")
    .select("*")
    .eq("project_id", projectId)
    .eq("business_id", bid)
    .order("created_at", { ascending: false });
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (profile.role === "client") {
    // Estimates & Proposals hidden from clients on this project → nothing to list.
    const { data: sectionRow } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("business_id", bid)
      .maybeSingle();
    if (sectionRow && (sectionRow as { client_section_estimates?: boolean }).client_section_estimates === false) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      (data ?? []).map((row: { travel_one_way_miles?: unknown }) => {
        const { travel_one_way_miles: _miles, ...rest } = row;
        return rest;
      })
    );
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, title, description, line_items, notes, expires_at, send } = body;
  const timeZone = safeTimeZone(body.time_zone);
  // The editor picks the id up front so its preview shows the real reference
  // and a retried request finds the row it already created.
  const requestedId = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null;

  if (!project_id || !title || !line_items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const { canAccessProject } = await import("@/lib/project-access");
  if (!(await canAccessProject(profile, project_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await createTenantServiceClient(businessId);
  const appSettings = await getAppSettings(businessId);
  const manualTravel = manualTravelLineItems(line_items, body, appSettings);
  const pricedLineItems = manualTravel.lineItems;
  const total_cents = pricedLineItems.reduce(
    (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
    0
  );
  // Clicking Send is the business's review: an explicit send always sends.
  const willSend = Boolean(send);
  const status = willSend ? "sent" : "draft";
  const expiresAt = willSend
    ? addProposalExpiration(new Date(), appSettings.proposals.defaultProposalExpirationDays)
    : null;

  if (requestedId) {
    const { data: existing } = await db
      .from("project_quotes")
      .select("*")
      .eq("id", requestedId)
      .maybeSingle();
    if (existing) {
      if (existing.project_id !== project_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      // Same request again (double click, network retry): nothing new is created or sent.
      return NextResponse.json({ ...existing, delivery: null, duplicate_request: true });
    }
  }

  const quoteId = requestedId ?? crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const row = {
    id: quoteId,
    project_id,
    title,
    description: description || null,
    line_items: pricedLineItems,
    total_cents,
    ...(manualTravel.oneWayMiles !== undefined ? { travel_one_way_miles: manualTravel.oneWayMiles } : {}),
    notes: notes || null,
    expires_at: expires_at || expiresAt,
    status,
    quote_kind: "official" as const,
    sent_at: willSend ? nowIso : null,
    created_by: profile.id,
    // Pinned so the PDF's issue date and the row agree.
    ...(willSend ? { created_at: nowIso } : {}),
    ...depositColumnsForQuote(body, appSettings.workflow.payments),
  };

  let prepared: { pdf: PreparedPdf; projectName: string } | null = null;
  if (willSend) {
    const result = await prepareSendPdf(
      businessId,
      {
        ...row,
        business_id: businessId,
        approved_at: null,
        changes_feedback: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as ProjectQuote,
      appSettings,
      timeZone
    );
    if (!result.ok) return NextResponse.json({ error: PDF_FAILED_MESSAGE, code: "pdf_failed" }, { status: 500 });
    prepared = result;
  }

  const { data: quote, error } = await db.from("project_quotes").insert(row).select().single();

  if (error) {
    if (error.code === "23505" && requestedId) {
      const { data: existing } = await db.from("project_quotes").select("*").eq("id", requestedId).maybeSingle();
      if (existing) return NextResponse.json({ ...existing, delivery: null, duplicate_request: true });
    }
    if (error.code === "23514") return NextResponse.json({ error: LATER_TERMS_UNAVAILABLE }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await archivePreviousOfficialQuotes(businessId, project_id, quote.id);

  let delivery: ProposalDelivery | null = null;
  if (willSend && prepared) {
    await setProjectStatusForward({
      projectId: project_id,
      status: "quote_sent",
      userId: profile.id,
      activityType: "quote_sent",
      activityDescription: `💼 Quote sent: ${title}`,
      notifyClient: false,
      skipIfSame: true,
    });

    await logProjectActivity("official_proposal_sent", "📄 Official Proposal sent", {
      businessId,
      projectId: project_id,
      userId: profile.id,
      metadata: { quoteId: quote.id, total_cents },
    });

    delivery = await deliverProposal({
      businessId,
      quote: quote as ProjectQuote,
      appSettings,
      pdf: prepared.pdf,
      projectName: prepared.projectName,
      title: "Your official proposal is ready",
    });
  }

  return NextResponse.json({ ...quote, delivery });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const body = await request.json();
  const { id, action, feedback } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const db = await createTenantServiceClient(businessId);
  const cookie = (isOwnerAdmin(profile) || staffCan(profile, "money.view") || staffCan(profile, "money.create_send_estimates")) ? null : await createClient();

  const { data: quote } = cookie
    ? await cookie.from("project_quotes").select("*").eq("id", id).eq("business_id", businessId).single()
    : await db.from("project_quotes").select("*").eq("id", id).single();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.business_id && quote.business_id !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { canAccessProject } = await import("@/lib/project-access");
  if (!(await canAccessProject(profile, quote.project_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "send" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    if (quote.quote_kind === "preliminary") {
      return NextResponse.json(
        { error: "Use Send Estimate on the preliminary estimate to send it as the official proposal." },
        { status: 400 }
      );
    }
    if (quote.status === "sent" || quote.status === "approved") {
      // Already sent (a retry or a second tab): never re-send or re-log.
      return NextResponse.json({ ...quote, delivery: null, duplicate_request: true });
    }
    const appSettings = await getAppSettings(businessId);
    const sentAt = new Date().toISOString();

    const expiresAt =
      appSettings.workflow.proposals.autoSetExpiration
        ? addProposalExpiration(new Date(), appSettings.proposals.defaultProposalExpirationDays)
        : quote.expires_at;

    const depositPatch =
      quote.deposit_mode == null
        ? depositTermColumns({
            depositMode: appSettings.workflow.payments.depositMode,
            depositPercent: appSettings.workflow.payments.depositPercent,
            depositAmountCents: appSettings.workflow.payments.depositAmountCents,
          })
        : {};

    const sendPatch = {
      status: "sent" as const,
      sent_at: sentAt,
      ...depositPatch,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    };
    const prepared = await prepareSendPdf(
      businessId,
      { ...(quote as ProjectQuote), ...sendPatch },
      appSettings,
      safeTimeZone(body.time_zone)
    );
    if (!prepared.ok) {
      return NextResponse.json({ error: PDF_FAILED_MESSAGE, code: "pdf_failed" }, { status: 500 });
    }

    await archivePreviousOfficialQuotes(businessId, quote.project_id, id);

    // Conditional on the status we read, so two concurrent sends cannot both deliver.
    const { data: updated } = await db
      .from("project_quotes")
      .update(sendPatch)
      .eq("id", id)
      .eq("status", quote.status)
      .select()
      .maybeSingle();

    if (!updated) {
      const { data: current } = await db.from("project_quotes").select("*").eq("id", id).maybeSingle();
      return NextResponse.json({ ...(current ?? quote), delivery: null, duplicate_request: true });
    }

    await setProjectStatusForward({
      projectId: quote.project_id,
      status: "quote_sent",
      userId: profile.id,
      activityType: "quote_sent",
      activityDescription: `Quote sent: ${quote.title}`,
      skipIfSame: true,
    });

    await logProjectActivity("official_proposal_sent", "📄 Official Proposal sent", {
      businessId,
      projectId: quote.project_id,
      userId: profile.id,
      idempotencyKey: idempotencyKey("quote", id, "send"),
      metadata: { quoteId: id },
    });

    const delivery = await deliverProposal({
      businessId,
      quote: updated as ProjectQuote,
      appSettings,
      pdf: prepared.pdf,
      projectName: prepared.projectName,
      title: "Review Proposal",
    });

    return NextResponse.json({ ...updated, delivery });
  }

  if (action === "resend_email" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    // Email-only retry for the recipients whose email failed. No status, activity or in-app changes.
    if (quote.quote_kind === "preliminary" || !["sent", "approved", "changes_requested"].includes(quote.status)) {
      return NextResponse.json({ error: "Only a sent proposal can be emailed again." }, { status: 400 });
    }
    const userIds = Array.isArray(body.user_ids)
      ? (body.user_ids as unknown[]).filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
      : [];
    if (!userIds.length) {
      return NextResponse.json({ error: "Choose who to email again." }, { status: 400 });
    }
    const appSettings = await getAppSettings(businessId);
    let pdf: Awaited<ReturnType<typeof ensureProposalPdf>>;
    try {
      pdf = await ensureProposalPdf({
        businessId,
        quote: quote as ProjectQuote,
        appSettings,
        timeZone: safeTimeZone(body.time_zone),
      });
    } catch (error) {
      console.error("[quotes] proposal PDF render failed (resend)", { quoteId: id, error });
      return NextResponse.json({ error: "The proposal PDF couldn't be generated. Nothing was emailed.", code: "pdf_failed" }, { status: 500 });
    }
    const email = await emailProposalToClients({
      businessId,
      quote: quote as ProjectQuote,
      appSettings,
      pdfBytes: pdf.bytes,
      projectName: pdf.projectName,
      title: "Review Proposal",
      retryUserIds: userIds,
    });
    const delivery: ProposalDelivery = {
      pdf: { attached: true, stored: pdf.stored, error: pdf.storeError },
      email,
    };
    return NextResponse.json({ ...quote, delivery });
  }

  if (action === "convert_to_official" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    if (quote.quote_kind !== "preliminary") {
      return NextResponse.json({ error: "Only preliminary estimates can be converted." }, { status: 400 });
    }

    // "Send Estimate": the business reviewed (and possibly edited) the preliminary estimate.
    // Its click is the review, so this always sends the official proposal — never a draft
    // that needs a second Send. The editor picks official_id up front so a double click or
    // retry finds the proposal it already sent instead of sending a second one.
    const requestedOfficialId =
      typeof body.official_id === "string" && UUID_RE.test(body.official_id) ? body.official_id : null;
    if (requestedOfficialId) {
      const { data: already } = await db
        .from("project_quotes")
        .select("*")
        .eq("id", requestedOfficialId)
        .maybeSingle();
      if (already) {
        if (already.project_id !== quote.project_id) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ ...already, delivery: null, duplicate_request: true });
      }
    }

    const appSettings = await getAppSettings(businessId);
    const proposalExpiresAt = addProposalExpiration(
      new Date(),
      appSettings.proposals.defaultProposalExpirationDays
    );

    const { title, description, line_items, notes, expires_at } = body;
    const sourceLineItems = line_items?.length ? line_items : quote.line_items;
    const manualTravel = manualTravelLineItems(sourceLineItems, body, appSettings);
    const finalLineItems = manualTravel.lineItems;
    const finalTitle = title || quote.title.replace(/^Preliminary Estimate — /, "Official Proposal — ");
    const total_cents = finalLineItems.reduce(
      (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
      0
    );
    const officialId = requestedOfficialId ?? crypto.randomUUID();
    const convertedAt = new Date().toISOString();
    const officialRow = {
      id: officialId,
      project_id: quote.project_id,
      title: finalTitle.startsWith("Official Proposal")
        ? finalTitle
        : `Official Proposal — ${finalTitle}`,
      description: description ?? quote.description,
      line_items: finalLineItems,
      total_cents,
      notes: notes ?? quote.notes,
      expires_at: expires_at || proposalExpiresAt || quote.expires_at,
      status: "sent" as const,
      quote_kind: "official" as const,
      sent_at: convertedAt,
      created_by: profile.id,
      travel_one_way_miles:
        manualTravel.oneWayMiles !== undefined
          ? manualTravel.oneWayMiles
          : (quote.travel_one_way_miles ?? null),
      ...depositColumnsForQuote(
        parseExplicitDepositTerms(body)
          ? body
          : quote.deposit_mode != null
            ? {
                deposit_mode: quote.deposit_mode,
                deposit_percent: quote.deposit_percent,
                deposit_amount_cents: quote.deposit_amount_cents,
              }
            : {},
        appSettings.workflow.payments
      ),
      created_at: convertedAt,
    };

    const convertPdf = await prepareSendPdf(
      businessId,
      {
        ...officialRow,
        business_id: businessId,
        approved_at: null,
        changes_feedback: null,
        updated_at: convertedAt,
      } as ProjectQuote,
      appSettings,
      safeTimeZone(body.time_zone)
    );
    if (!convertPdf.ok) {
      return NextResponse.json({ error: PDF_FAILED_MESSAGE, code: "pdf_failed" }, { status: 500 });
    }

    const { data: official, error: officialError } = await db
      .from("project_quotes")
      .insert(officialRow)
      .select()
      .single();

    if (officialError) {
      if (officialError.code === "23505" && requestedOfficialId) {
        const { data: existing } = await db.from("project_quotes").select("*").eq("id", requestedOfficialId).maybeSingle();
        if (existing) return NextResponse.json({ ...existing, delivery: null, duplicate_request: true });
      }
      if (officialError.code === "23514") {
        return NextResponse.json({ error: LATER_TERMS_UNAVAILABLE }, { status: 400 });
      }
      return NextResponse.json({ error: officialError.message }, { status: 500 });
    }

    // Keep the preliminary estimate in step with what was sent (history, and the editor).
    if (line_items?.length || title || description !== undefined || notes !== undefined) {
      await db
        .from("project_quotes")
        .update({
          description: description ?? quote.description,
          line_items: finalLineItems,
          total_cents,
          notes: notes ?? quote.notes,
        })
        .eq("id", id);
    }

    await archivePreviousOfficialQuotes(businessId, quote.project_id, official.id);

    await setProjectStatusForward({
      projectId: quote.project_id,
      status: "quote_sent",
      userId: profile.id,
      activityType: "quote_sent",
      activityDescription: `Official proposal sent: ${official.title}`,
      notifyClient: false,
      skipIfSame: true,
    });

    await logProjectActivity("official_proposal_sent", "📄 Official Proposal sent", {
      businessId,
      projectId: quote.project_id,
      userId: profile.id,
      idempotencyKey: idempotencyKey("quote", official.id, "send"),
      metadata: { quoteId: official.id, preliminaryQuoteId: id },
    });

    const convertDelivery = await deliverProposal({
      businessId,
      quote: official as ProjectQuote,
      appSettings,
      pdf: convertPdf.pdf,
      projectName: convertPdf.projectName,
      title: "Your official proposal is ready",
    });

    return NextResponse.json({ ...official, delivery: convertDelivery });
  }

  if (action === "approve" && profile.role === "client") {
    if (quote.quote_kind === "preliminary") {
      return NextResponse.json(
        { error: "Preliminary estimates cannot be approved. Wait for the official proposal." },
        { status: 400 }
      );
    }
    if (quote.status !== "sent" && quote.status !== "approved") {
      return NextResponse.json(
        { error: "This proposal is no longer open for approval. Refresh to see the latest proposal." },
        { status: 409 }
      );
    }
    const appSettings = await getAppSettings(businessId);

    // Already approved (double click, refresh, retry, or "Pay Now" later): approve nothing
    // again, just make sure the approval invoice is there. Never creates a second one.
    if (quote.status === "approved") {
      const approval_payment = await ensureApprovalPayment({
        businessId,
        quote: quote as ProjectQuote,
        appSettings,
        actorUserId: profile.id,
        fresh: false,
      });
      return NextResponse.json({ ...quote, approval_payment });
    }

    // Conditional on "sent", so two concurrent approvals cannot both run the approval steps.
    const { data: updated } = await db
      .from("project_quotes")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "sent")
      .select()
      .maybeSingle();

    if (!updated) {
      const { data: current } = await db.from("project_quotes").select("*").eq("id", id).maybeSingle();
      const row = (current ?? quote) as ProjectQuote;
      const approval_payment =
        row.status === "approved"
          ? await ensureApprovalPayment({ businessId, quote: row, appSettings, actorUserId: profile.id, fresh: false })
          : null;
      return NextResponse.json({ ...row, approval_payment });
    }

    const approvedQuote = { ...quote, ...updated, status: "approved" as const } as ProjectQuote;
    const willAutoPay = quoteCollectsPaymentOnApproval(approvedQuote, {
      autoCreateOnApproval: appSettings.workflow.payments.autoCreatePaymentLinkOnApproval,
      business: appSettings.workflow.payments,
    });

    await setProjectStatus({
      projectId: quote.project_id,
      status: "proposal_approved",
      userId: profile.id,
      activityType: "quote_approved",
      activityDescription: "✅ Proposal approved",
      idempotencyKey: idempotencyKey("quote", id, "approve"),
      skipWorkflowAudit: willAutoPay,
    });

    const approval_payment = await ensureApprovalPayment({
      businessId,
      quote: approvedQuote,
      appSettings,
      actorUserId: profile.id,
      fresh: true,
    });

    let adminBody = `The client approved the proposal for "${quote.title}".`;
    if (approval_payment.status === "ready") {
      adminBody += " Their invoice was created automatically and they can pay now.";
    } else if (approval_payment.status === "unavailable") {
      adminBody +=
        approval_payment.reason === "stripe_not_ready"
          ? " Connect Stripe to let clients pay immediately when they approve."
          : approval_payment.reason === "no_client"
            ? " No invoice was created because the project has no client."
            : " The invoice couldn't be created automatically. Create it from the project's Payments tab.";
    }

    await notifyAdmins({
      businessId,
      type: "proposal_approved",
      eventKey: "proposal_approved",
      title: "Proposal Approved",
      body: adminBody,
      link: `/admin/projects/${quote.project_id}`,
      projectId: quote.project_id,
    });

    return NextResponse.json({ ...updated, approval_payment });
  }

  if (action === "request_changes" && profile.role === "client") {
    if (quote.quote_kind === "preliminary") {
      return NextResponse.json(
        { error: "Request changes on the official proposal once it is sent." },
        { status: 400 }
      );
    }
    if (quote.status === "changes_requested") {
      return NextResponse.json(quote);
    }
    const { data: updated } = await db
      .from("project_quotes")
      .update({ status: "changes_requested", changes_feedback: feedback || null })
      .eq("id", id)
      .select()
      .single();

    await logProjectActivity("quote_changes_requested", `Client requested quote changes: ${feedback || "No details"}`, {
      businessId,
      projectId: quote.project_id,
      userId: profile.id,
      idempotencyKey: idempotencyKey("quote", id, "changes_requested"),
      metadata: { feedback, quoteId: id },
    });

    await notifyAdmins({
      businessId,
      type: "proposal_changes",
      eventKey: "proposal_changes_requested",
      title: "Proposal Changes Requested",
      body: feedback || "The client requested changes to the proposal.",
      link: `/admin/projects/${quote.project_id}#quote`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
  }

  if (action === "update" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    const isPreliminary = quote.quote_kind === "preliminary";
    if (!isPreliminary && quote.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft proposals or preliminary estimates can be edited. Duplicate to create a revision." },
        { status: 400 }
      );
    }

    const { title, description, line_items, notes, expires_at } = body;
    if (!title || !line_items?.length) {
      return NextResponse.json({ error: "Title and line items required" }, { status: 400 });
    }

    const appSettings = await getAppSettings(businessId);
    const manualTravel = manualTravelLineItems(line_items, body, appSettings);
    const pricedLineItems = manualTravel.lineItems;
    const total_cents = pricedLineItems.reduce(
      (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
      0
    );
    const explicitTerms = parseExplicitDepositTerms(body);

    const { data: updated, error } = await db
      .from("project_quotes")
      .update({
        title,
        description: description || null,
        line_items: pricedLineItems,
        total_cents,
        notes: notes || null,
        ...(manualTravel.oneWayMiles !== undefined ? { travel_one_way_miles: manualTravel.oneWayMiles } : {}),
        expires_at: expires_at || null,
        ...(explicitTerms ? depositTermColumns(explicitTerms) : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error?.code === "23514") return NextResponse.json({ error: LATER_TERMS_UNAVAILABLE }, { status: 400 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (action === "duplicate" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    const revisionNumber = body.revision_label || "Revised";
    const appSettings = await getAppSettings(businessId);
    // The source proposal is read, never written: its status, timestamps,
    // payments and stored PDF stay as they were. Older proposals are archived
    // only when this revision is actually sent.
    const sourceTerms =
      quote.deposit_mode != null
        ? {
            deposit_mode: quote.deposit_mode,
            deposit_percent: quote.deposit_percent ?? null,
            deposit_amount_cents: quote.deposit_amount_cents ?? null,
          }
        : depositColumnsForQuote({}, appSettings.workflow.payments);
    const baseTitle = String(quote.title).replace(/\s*\((?:Revised|Revision)[^)]*\)\s*$/i, "");
    const { data: newQuote, error } = await db
      .from("project_quotes")
      .insert({
        project_id: quote.project_id,
        title: body.title || `${baseTitle} (${revisionNumber})`,
        description: quote.description,
        line_items: quote.line_items,
        total_cents: quote.total_cents,
        travel_one_way_miles: quote.travel_one_way_miles ?? null,
        notes: body.notes ?? (notesWithoutArchiveMarker(quote.notes) || null),
        expires_at: quote.expires_at,
        status: "draft",
        quote_kind: "official",
        created_by: profile.id,
        ...sourceTerms,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logProjectActivity("quote_revised", `Draft revision created from "${quote.title}"`, {
      businessId,
      projectId: quote.project_id,
      userId: profile.id,
      metadata: { sourceQuoteId: id, newQuoteId: newQuote.id },
    });

    return NextResponse.json(newQuote);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
