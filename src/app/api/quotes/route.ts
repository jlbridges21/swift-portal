import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { setProjectStatus, setProjectStatusForward } from "@/lib/status-automation";
import { getAppSettings, addProposalExpiration } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { portalLink, resolveProjectMessageTemplate, logWorkflowAudit, logWorkflowSkipped } from "@/lib/workflow";
import { archivePreviousOfficialQuotes } from "@/lib/quote-archive";
import { canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { createPaymentLink } from "@/lib/create-payment-link";
import {
  canCreatePaymentFromQuote,
  depositPaymentDescription,
  depositTermColumns,
  parseExplicitDepositTerms,
  paymentLinkTitle,
  resolveDepositCharge,
  resolveQuoteDepositTerms,
} from "@/lib/payment-quote";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";
import { StripeConnectNotReadyError } from "@/lib/stripe-connect";

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
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, title, description, line_items, notes, expires_at, send } = body;

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

  const total_cents = line_items.reduce(
    (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
    0
  );

  const db = await createTenantServiceClient(businessId);
  const appSettings = await getAppSettings(businessId);
  const requireReview = appSettings.proposals.requireAdminReviewBeforeOfficial;
  const willSend = Boolean(send) && !requireReview;
  const status = willSend ? "sent" : send ? "draft" : "draft";
  const expiresAt = willSend
    ? addProposalExpiration(new Date(), appSettings.proposals.defaultProposalExpirationDays)
    : null;

  const { data: quote, error } = await db
    .from("project_quotes")
    .insert({
      project_id,
      title,
      description: description || null,
      line_items,
      total_cents,
      notes: notes || null,
      expires_at: expires_at || expiresAt,
      status,
      quote_kind: "official",
      sent_at: willSend ? new Date().toISOString() : null,
      created_by: profile.id,
      ...depositColumnsForQuote(body, appSettings.workflow.payments),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await archivePreviousOfficialQuotes(businessId, project_id, quote.id);

  if (willSend) {
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

    await notifyProjectClients({
      businessId,
      type: "quote_sent",
      eventKey: "official_proposal_sent",
      title: "Your official proposal is ready",
      body: `${appSettings.business.businessName} sent an official proposal for "${title}". Review and approve in your portal.`,
      link: `/dashboard/projects/${project_id}#quote`,
      projectId: project_id,
    });
  }

  return NextResponse.json(quote);
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
        { error: "Use Convert to Official Proposal for preliminary estimates." },
        { status: 400 }
      );
    }
    if (quote.status === "sent" || quote.status === "approved") {
      return NextResponse.json(quote);
    }
    const appSettings = await getAppSettings(businessId);

    await archivePreviousOfficialQuotes(businessId, quote.project_id, id);

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

    const { data: updated } = await db
      .from("project_quotes")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        ...depositPatch,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      })
      .eq("id", id)
      .select()
      .single();

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

    await notifyProjectClients({
      businessId,
      type: "quote_sent",
      eventKey: "official_proposal_sent",
      title: "Review Proposal",
      body: await resolveProjectMessageTemplate(
        appSettings.workflow,
        "proposal_ready",
        quote.project_id,
        {
          project_name: quote.title,
          portal_link: await portalLink(`/dashboard/projects/${quote.project_id}#quote`, businessId),
        },
        `Review your proposal for "${quote.title}".`
      ),
      link: `/dashboard/projects/${quote.project_id}#quote`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
  }

  if (action === "convert_to_official" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    if (quote.quote_kind !== "preliminary") {
      return NextResponse.json({ error: "Only preliminary estimates can be converted." }, { status: 400 });
    }

    const appSettings = await getAppSettings(businessId);
    const requireReview = appSettings.proposals.requireAdminReviewBeforeOfficial;
    const proposalExpiresAt = addProposalExpiration(
      new Date(),
      appSettings.proposals.defaultProposalExpirationDays
    );

    const { title, description, line_items, notes, expires_at } = body;
    const finalLineItems = line_items?.length ? line_items : quote.line_items;
    const finalTitle = title || quote.title.replace(/^Preliminary Estimate — /, "Official Proposal — ");
    const total_cents = finalLineItems.reduce(
      (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
      0
    );

    if (line_items?.length || title || description !== undefined || notes !== undefined) {
      await db
        .from("project_quotes")
        .update({
          title: title || quote.title,
          description: description ?? quote.description,
          line_items: finalLineItems,
          total_cents,
          notes: notes ?? quote.notes,
          expires_at: expires_at ?? quote.expires_at,
        })
        .eq("id", id);
    }

    const { data: official, error: officialError } = await db
      .from("project_quotes")
      .insert({
        project_id: quote.project_id,
        title: finalTitle.startsWith("Official Proposal")
          ? finalTitle
          : `Official Proposal — ${finalTitle}`,
        description: description ?? quote.description,
        line_items: finalLineItems,
        total_cents,
        notes: notes ?? quote.notes,
        expires_at: expires_at ?? proposalExpiresAt ?? quote.expires_at,
        status: requireReview ? "draft" : "sent",
        quote_kind: "official",
        sent_at: requireReview ? null : new Date().toISOString(),
        created_by: profile.id,
        ...depositColumnsForQuote(body, appSettings.workflow.payments),
      })
      .select()
      .single();

    if (officialError) {
      return NextResponse.json({ error: officialError.message }, { status: 500 });
    }

    await archivePreviousOfficialQuotes(businessId, quote.project_id, official.id);

    if (!requireReview) {
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
        metadata: { quoteId: official.id, preliminaryQuoteId: id },
      });

      await notifyProjectClients({
        businessId,
        type: "quote_sent",
        eventKey: "official_proposal_sent",
        title: "Your official proposal is ready",
        body: `${appSettings.business.businessName} sent your official proposal. Review and approve it in your portal.`,
        link: `/dashboard/projects/${quote.project_id}#quote`,
        projectId: quote.project_id,
      });
    } else {
      await logProjectActivity("quote_sent", `Official proposal draft created: ${official.title}`, {
        businessId,
        projectId: quote.project_id,
        userId: profile.id,
        metadata: { quoteId: official.id, preliminaryQuoteId: id, requiresReview: true },
      });
    }

    return NextResponse.json(official);
  }

  if (action === "approve" && profile.role === "client") {
    if (quote.quote_kind === "preliminary") {
      return NextResponse.json(
        { error: "Preliminary estimates cannot be approved. Wait for the official proposal." },
        { status: 400 }
      );
    }
    if (quote.status === "approved") {
      return NextResponse.json(quote);
    }
    const { data: updated } = await db
      .from("project_quotes")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "approved")
      .select()
      .maybeSingle();

    if (!updated) {
      const { data: current } = await db.from("project_quotes").select("*").eq("id", id).maybeSingle();
      return NextResponse.json(current ?? quote);
    }

    const appSettings = await getAppSettings(businessId);
    const approvedQuote = { ...quote, ...updated, status: "approved" as const };
    const willAutoPay =
      appSettings.workflow.payments.autoCreatePaymentLinkOnApproval &&
      canCreatePaymentFromQuote(approvedQuote);

    await setProjectStatus({
      projectId: quote.project_id,
      status: "proposal_approved",
      userId: profile.id,
      activityType: "quote_approved",
      activityDescription: "✅ Proposal approved",
      idempotencyKey: idempotencyKey("quote", id, "approve"),
      skipWorkflowAudit: willAutoPay,
    });

    let stripeNotReady = false;
    if (willAutoPay) {
      try {
        const { data: project } = await db
          .from("projects")
          .select("id, client_id, project_name, property_address, service_type")
          .eq("id", quote.project_id)
          .maybeSingle();
        if (!project?.client_id) {
          await logWorkflowSkipped(
            quote.project_id,
            "Payment link was not created after approval because the project has no client.",
            idempotencyKey("workflow", "approval-payment-skipped", id)
          );
        } else {
          const { data: client } = await db
            .from("clients")
            .select("name")
            .eq("id", project.client_id)
            .maybeSingle();
          const charge = resolveDepositCharge(
            approvedQuote.total_cents,
            resolveQuoteDepositTerms(approvedQuote, appSettings.workflow.payments)
          );
          if (charge.fallback) {
            console.warn("[payment] deposit fell back to the full quote total", {
              businessId,
              quoteId: id,
              reason: charge.fallback,
            });
            await logWorkflowAudit(quote.project_id, charge.fallback, {
              userId: profile.id,
              idempotencyKey: idempotencyKey("workflow", "deposit-fallback", id),
            });
          }
          const title = paymentLinkTitle(
            client?.name || "Client",
            project.property_address || "",
            project.service_type || "Service"
          );
          const description = charge.isDeposit
            ? depositPaymentDescription(charge.amountCents, approvedQuote.total_cents)
            : title;
          await createPaymentLink({
            businessId,
            projectId: quote.project_id,
            clientId: project.client_id,
            quoteId: id,
            amount: charge.amountCents,
            description,
            actorUserId: profile.id,
            origin: "approval",
            followUpToApproval: true,
            quoteTotalCents: approvedQuote.total_cents,
            isDeposit: charge.isDeposit,
          });
        }
      } catch (err) {
        if (err instanceof StripeConnectNotReadyError) {
          stripeNotReady = true;
          await logWorkflowSkipped(
            quote.project_id,
            "Payment link was not created after approval because Stripe is not connected. Connect Stripe to let clients pay immediately when they approve.",
            idempotencyKey("workflow", "approval-payment-stripe", id)
          );
        } else {
          console.error("[payment] auto-create after approval failed", err);
          await logWorkflowSkipped(
            quote.project_id,
            "Payment link was not created after approval. The proposal is still approved, and the payment can be created manually.",
            idempotencyKey("workflow", "approval-payment-failed", id)
          );
        }
      }
    }

    const adminBody = stripeNotReady
      ? `The client approved the proposal for "${quote.title}". Connect Stripe to let clients pay immediately when they approve.`
      : `The client approved the proposal for "${quote.title}".`;

    await notifyAdmins({
      businessId,
      type: "proposal_approved",
      eventKey: "proposal_approved",
      title: "Proposal Approved",
      body: adminBody,
      link: `/admin/projects/${quote.project_id}`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
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

    const total_cents = line_items.reduce(
      (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
      0
    );
    const explicitTerms = parseExplicitDepositTerms(body);

    const { data: updated, error } = await db
      .from("project_quotes")
      .update({
        title,
        description: description || null,
        line_items,
        total_cents,
        notes: notes || null,
        expires_at: expires_at || null,
        ...(explicitTerms ? depositTermColumns(explicitTerms) : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (action === "duplicate" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {
    const revisionNumber = body.revision_label || "Revised";
    const appSettings = await getAppSettings(businessId);
    const { data: newQuote, error } = await db
      .from("project_quotes")
      .insert({
        project_id: quote.project_id,
        title: body.title || `${quote.title} (${revisionNumber})`,
        description: quote.description,
        line_items: quote.line_items,
        total_cents: quote.total_cents,
        notes: body.notes ?? quote.notes,
        expires_at: quote.expires_at,
        status: "draft",
        quote_kind: "official",
        created_by: profile.id,
        ...depositColumnsForQuote({}, appSettings.workflow.payments),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await archivePreviousOfficialQuotes(businessId, quote.project_id, newQuote.id);

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
