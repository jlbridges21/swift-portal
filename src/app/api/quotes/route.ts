import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_quotes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, title, description, line_items, notes, expires_at, send } = body;

  if (!project_id || !title || !line_items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const total_cents = line_items.reduce(
    (sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0),
    0
  );

  const supabase = await createServiceClient();
  const status = send ? "sent" : "draft";

  const { data: quote, error } = await supabase
    .from("project_quotes")
    .insert({
      project_id,
      title,
      description: description || null,
      line_items,
      total_cents,
      notes: notes || null,
      expires_at: expires_at || null,
      status,
      sent_at: send ? new Date().toISOString() : null,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (send) {
    await setProjectStatus({
      projectId: project_id,
      status: "quote_sent",
      userId: profile.id,
      activityType: "quote_sent",
      activityDescription: `💼 Quote sent: ${title}`,
      notifyClient: false,
      skipIfSame: true,
    });

    await logProjectActivity("quote_sent", `💼 Quote sent: ${title}`, {
      projectId: project_id,
      userId: profile.id,
      metadata: { quoteId: quote.id, total_cents },
    });

    await notifyProjectClients({
      type: "quote_sent",
      title: "Review Your Proposal",
      body: `Swift Aerial Media sent a proposal for "${title}". Review and approve in your portal.`,
      link: `/dashboard/projects/${project_id}#quote`,
      projectId: project_id,
    });
  }

  return NextResponse.json(quote);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, action, feedback } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const supabase = profile.role === "admin" ? await createServiceClient() : await createClient();

  const { data: quote } = await supabase.from("project_quotes").select("*").eq("id", id).single();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "send" && profile.role === "admin") {
    const service = await createServiceClient();
    const { data: updated } = await service
      .from("project_quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    await setProjectStatus({
      projectId: quote.project_id,
      status: "quote_sent",
      userId: profile.id,
      activityType: "quote_sent",
      activityDescription: `Quote sent: ${quote.title}`,
      skipIfSame: true,
    });

    await notifyProjectClients({
      type: "quote_sent",
      title: "Review Your Proposal",
      body: `Review your proposal for "${quote.title}".`,
      link: `/dashboard/projects/${quote.project_id}#quote`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
  }

  if (action === "approve" && profile.role === "client") {
    const service = await createServiceClient();
    const { data: updated } = await service
      .from("project_quotes")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    await setProjectStatus({
      projectId: quote.project_id,
      status: "proposal_approved",
      userId: profile.id,
      activityType: "quote_approved",
      activityDescription: "✅ Proposal approved",
    });

    await logProjectActivity("quote_approved", "✅ Proposal approved", {
      projectId: quote.project_id,
      userId: profile.id,
    });

    await notifyAdmins({
      type: "proposal_approved",
      title: "Proposal Approved",
      body: `The client approved the proposal for "${quote.title}".`,
      link: `/admin/projects/${quote.project_id}`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
  }

  if (action === "request_changes" && profile.role === "client") {
    const service = await createServiceClient();
    const { data: updated } = await service
      .from("project_quotes")
      .update({ status: "changes_requested", changes_feedback: feedback || null })
      .eq("id", id)
      .select()
      .single();

    await logProjectActivity("quote_changes_requested", `Client requested quote changes: ${feedback || "No details"}`, {
      projectId: quote.project_id,
      userId: profile.id,
      metadata: { feedback, quoteId: id },
    });

    await notifyAdmins({
      type: "proposal_changes",
      title: "Proposal Changes Requested",
      body: feedback || "The client requested changes to the proposal.",
      link: `/admin/projects/${quote.project_id}#quote`,
      projectId: quote.project_id,
    });

    return NextResponse.json(updated);
  }

  if (action === "update" && profile.role === "admin") {
    if (quote.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft proposals can be edited. Duplicate to create a revision." },
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

    const service = await createServiceClient();
    const { data: updated, error } = await service
      .from("project_quotes")
      .update({
        title,
        description: description || null,
        line_items,
        total_cents,
        notes: notes || null,
        expires_at: expires_at || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (action === "duplicate" && profile.role === "admin") {
    const service = await createServiceClient();
    const revisionNumber = body.revision_label || "Revised";
    const { data: newQuote, error } = await service
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
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logProjectActivity("quote_revised", `Draft revision created from "${quote.title}"`, {
      projectId: quote.project_id,
      userId: profile.id,
      metadata: { sourceQuoteId: id, newQuoteId: newQuote.id },
    });

    return NextResponse.json(newQuote);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
