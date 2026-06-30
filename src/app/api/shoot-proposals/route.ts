import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";
import { loadShootSyncContext, syncShootToGoogleCalendar } from "@/lib/google-calendar";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  const supabase = await createClient();
  let query = supabase.from("shoot_proposals").select("*").order("proposed_at", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.project_id || !body.proposed_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isAdmin = profile.role === "admin";
  const proposedBy = isAdmin ? "admin" : "client";

  if (!isAdmin && !profile.client_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = isAdmin ? await createServiceClient() : await createClient();

  const { data, error } = await supabase
    .from("shoot_proposals")
    .insert({
      project_id: body.project_id,
      proposed_by: proposedBy,
      proposed_at: body.proposed_at,
      message: body.message || null,
      status: "pending",
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dateStr = new Date(body.proposed_at).toLocaleString();
  const appSettings = await getAppSettings();
  const scheduling = appSettings.workflow.scheduling;

  if (scheduling.logSchedulingChanges) {
    await logProjectActivity("shoot_proposed", `Shoot proposed for ${dateStr}`, {
      projectId: body.project_id,
      userId: profile.id,
      metadata: { proposed_by: proposedBy },
    });
  }

  if (isAdmin && scheduling.notifyClientOnPropose) {
    await notifyProjectClients({
      type: "shoot_proposed",
      eventKey: "shoot_time_proposed",
      title: "Scheduling Your Shoot",
      body: await resolveProjectMessageTemplate(
        appSettings.workflow,
        "scheduling_request",
        body.project_id,
        { shoot_date: dateStr, portal_link: portalLink(`/dashboard/projects/${body.project_id}?scheduling=pending#scheduling`) },
        `Swift Aerial Media proposed a shoot for ${dateStr}. Please review and confirm in your portal.`
      ),
      link: `/dashboard/projects/${body.project_id}?scheduling=pending#scheduling`,
      projectId: body.project_id,
    });
  } else if (isAdmin) {
    await logWorkflowSkipped(
      body.project_id,
      "Client scheduling notification skipped — disabled in Scheduling Automation settings.",
      `workflow:scheduling-propose-skipped:${data.id}`
    );
  } else if (scheduling.notifyAdminOnCounter) {
    await notifyAdmins({
      type: "schedule_change_requested",
      eventKey: "shoot_time_proposed",
      title: "Client proposed a shoot date",
      body: `A client proposed a new shoot date: ${dateStr}`,
      link: `/admin/projects/${body.project_id}`,
      projectId: body.project_id,
    });
  } else {
    await logWorkflowSkipped(
      body.project_id,
      "Admin counter notification skipped — disabled in Scheduling Automation settings.",
      `workflow:scheduling-counter-skipped:${data.id}`
    );
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action, message, proposed_at, project_id } = body;

  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  if (action !== "reschedule" && !id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (action === "reschedule" && !project_id && !id) {
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }

  const isAdmin = profile.role === "admin";
  const supabase = isAdmin ? await createServiceClient() : await createClient();
  const serviceClient = await createServiceClient();

  const { data: proposal } = id
    ? await supabase.from("shoot_proposals").select("*").eq("id", id).single()
    : { data: null };

  if (action !== "reschedule" && !proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "accept") {
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (proposal.status === "confirmed") {
      return NextResponse.json({ success: true, status: "confirmed", alreadyConfirmed: true });
    }

    await serviceClient
      .from("shoot_proposals")
      .update({ status: "confirmed" })
      .eq("id", id);

    await serviceClient
      .from("shoot_proposals")
      .update({ status: "declined" })
      .eq("project_id", proposal.project_id)
      .neq("id", id)
      .in("status", ["pending"]);

    const dateStr = new Date(proposal.proposed_at).toLocaleString();
    const clientAcceptedAdminProposal = !isAdmin && proposal.proposed_by === "admin";

    await setProjectStatus({
      projectId: proposal.project_id,
      status: "scheduled",
      userId: profile.id,
      activityType: "shoot_confirmed",
      activityDescription: `Shoot confirmed for ${dateStr}`,
      notifyClient: true,
      clientTitle: "Shoot Scheduled",
      clientBody: `Your shoot is confirmed for ${dateStr}. We'll see you on site!`,
      link: `/dashboard/projects/${proposal.project_id}#scheduling`,
      clientEventKey: "shoot_scheduled",
      skipIfSame: true,
      idempotencyKey: idempotencyKey("shoot", id, "accept"),
    });

    await serviceClient
      .from("projects")
      .update({ shoot_date: proposal.proposed_at.split("T")[0] })
      .eq("id", proposal.project_id);

    await notifyAdmins({
      type: "shoot_proposed",
      eventKey: "shoot_time_confirmed",
      title: clientAcceptedAdminProposal ? "Client approved shoot time" : "Shoot confirmed",
      body: clientAcceptedAdminProposal
        ? `The client confirmed the shoot for ${dateStr}.`
        : `Shoot confirmed for ${dateStr}.`,
      link: `/admin/projects/${proposal.project_id}`,
      projectId: proposal.project_id,
    });

    const syncCtx = await loadShootSyncContext(id);
    const appSettings = await getAppSettings();
    if (syncCtx && appSettings.workflow.scheduling.syncGoogleCalendar) {
      void syncShootToGoogleCalendar(syncCtx);
      await logWorkflowAudit(proposal.project_id, "Google Calendar updated after shoot confirmation.", {
        idempotencyKey: idempotencyKey("workflow", "gcal", id, "accept"),
      });
    } else if (syncCtx) {
      await logWorkflowSkipped(
        proposal.project_id,
        "Google Calendar sync skipped — disabled in Scheduling Automation settings.",
        idempotencyKey("workflow", "gcal-skipped", id, "accept")
      );
    }

    return NextResponse.json({ success: true, status: "confirmed" });
  }

  if (action === "update_date" && isAdmin) {
    if (!id || !proposed_at) {
      return NextResponse.json({ error: "id and proposed_at required" }, { status: 400 });
    }

    const { data: shoot } = await serviceClient
      .from("shoot_proposals")
      .select("project_id")
      .eq("id", id)
      .single();

    if (!shoot) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await serviceClient
      .from("shoot_proposals")
      .update({ proposed_at })
      .eq("id", id);

    await serviceClient
      .from("projects")
      .update({ shoot_date: proposed_at.split("T")[0] })
      .eq("id", shoot.project_id);

    const dateStr = new Date(proposed_at).toLocaleString();
    const appSettings = await getAppSettings();
    const scheduling = appSettings.workflow.scheduling;

    if (scheduling.logSchedulingChanges) {
      await logProjectActivity("shoot_rescheduled", `Shoot rescheduled to ${dateStr}`, {
        projectId: shoot.project_id,
        userId: profile.id,
        idempotencyKey: idempotencyKey("shoot", id, "update_date", proposed_at),
      });
    }

    if (scheduling.notifyClientOnReschedule) {
      await notifyProjectClients({
        type: "shoot_proposed",
        eventKey: "shoot_rescheduled",
        title: "Shoot Scheduled",
        body: await resolveProjectMessageTemplate(
          appSettings.workflow,
          "shoot_confirmed",
          shoot.project_id,
          { shoot_date: dateStr },
          `Your shoot is now scheduled for ${dateStr}.`
        ),
        link: `/dashboard/projects/${shoot.project_id}#scheduling`,
        projectId: shoot.project_id,
      });
    } else {
      await logWorkflowSkipped(
        shoot.project_id,
        "Client reschedule notification skipped — disabled in Scheduling Automation settings.",
        idempotencyKey("workflow", "reschedule-skipped", id, proposed_at)
      );
    }

    const syncCtx = await loadShootSyncContext(id);
    if (syncCtx && scheduling.syncGoogleCalendar) {
      void syncShootToGoogleCalendar({ ...syncCtx, proposedAt: proposed_at });
      await logWorkflowAudit(shoot.project_id, "Google Calendar updated after reschedule.", {
        idempotencyKey: idempotencyKey("workflow", "gcal", id, proposed_at),
      });
    }

    return NextResponse.json({ success: true, proposed_at });
  }

  if (action === "reschedule") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!proposed_at) {
      return NextResponse.json({ error: "proposed_at required" }, { status: 400 });
    }

    const projectId = body.project_id || proposal!.project_id;

    const { data: confirmedProposal } = await serviceClient
      .from("shoot_proposals")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "confirmed")
      .maybeSingle();

    if (confirmedProposal) {
      await serviceClient
        .from("shoot_proposals")
        .update({ status: "superseded" })
        .eq("id", confirmedProposal.id);
    }

    const { data: newProposal } = await serviceClient
      .from("shoot_proposals")
      .insert({
        project_id: projectId,
        proposed_by: "admin",
        proposed_at,
        message: message || "Shoot rescheduled — please confirm the new date.",
        status: "pending",
        created_by: profile.id,
      })
      .select()
      .single();

    const dateStr = new Date(proposed_at).toLocaleString();
    await logProjectActivity("shoot_proposed", `New shoot date proposed: ${dateStr}`, {
      projectId,
      userId: profile.id,
      metadata: { proposed_by: "admin", rescheduled: true },
    });
    await setProjectStatus({
      projectId,
      status: "proposal_approved",
      userId: profile.id,
      activityDescription: `New shoot date proposed: ${dateStr}`,
      skipIfSame: true,
    });

    await notifyProjectClients({
      type: "shoot_proposed",
      eventKey: "shoot_rescheduled",
      title: "Scheduling Your Shoot",
      body: `Please confirm the new shoot date: ${dateStr}.`,
      link: `/dashboard/projects/${projectId}?scheduling=pending#scheduling`,
      projectId,
    });

    return NextResponse.json(newProposal);
  }

  if (action === "counter") {
    if (!proposed_at) {
      return NextResponse.json({ error: "proposed_at required for counter" }, { status: 400 });
    }

    await supabase.from("shoot_proposals").update({ status: "countered" }).eq("id", id);

    const { data: counter } = await supabase
      .from("shoot_proposals")
      .insert({
        project_id: proposal.project_id,
        proposed_by: isAdmin ? "admin" : "client",
        proposed_at,
        message: message || null,
        status: "pending",
        created_by: profile.id,
      })
      .select()
      .single();

    const dateStr = new Date(proposed_at).toLocaleString();
    await logProjectActivity("shoot_proposed", `Alternative shoot date proposed: ${dateStr}`, {
      projectId: proposal.project_id,
      userId: profile.id,
    });

    if (isAdmin) {
      await notifyProjectClients({
        type: "shoot_proposed",
        eventKey: "shoot_time_proposed",
        title: "Scheduling Your Shoot",
        body: `Swift Aerial Media proposed ${dateStr}. Please review.`,
        link: `/dashboard/projects/${proposal.project_id}?scheduling=pending#scheduling`,
        projectId: proposal.project_id,
      });
    } else {
      await notifyAdmins({
        type: "schedule_change_requested",
        eventKey: "shoot_time_proposed",
        title: "Client requested schedule change",
        body: `Client proposed an alternative date: ${dateStr}`,
        link: `/admin/projects/${proposal.project_id}`,
        projectId: proposal.project_id,
      });
    }

    return NextResponse.json(counter);
  }

  if (action === "decline") {
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (proposal.status === "declined") {
      return NextResponse.json({ success: true, alreadyDeclined: true });
    }

    await supabase.from("shoot_proposals").update({ status: "declined" }).eq("id", id);

    const dateStr = new Date(proposal.proposed_at).toLocaleString();
    const withdrawn = isAdmin && proposal.proposed_by === "admin";

    await logProjectActivity(
      withdrawn ? "shoot_withdrawn" : "shoot_declined",
      withdrawn
        ? `Shoot proposal withdrawn (${dateStr})`
        : `${isAdmin ? "Swift Aerial Media declined" : "Client declined"} shoot time ${dateStr}`,
      {
        projectId: proposal.project_id,
        userId: profile.id,
        idempotencyKey: idempotencyKey("shoot", id, withdrawn ? "withdrawn" : "decline"),
        metadata: { proposed_by: proposal.proposed_by, declined_by: isAdmin ? "admin" : "client" },
      }
    );

    if (withdrawn) {
      await notifyProjectClients({
        type: "schedule_change_requested",
        eventKey: "shoot_time_declined",
        title: "Shoot proposal withdrawn",
        body: `The proposed shoot time (${dateStr}) was withdrawn. We'll follow up with a new option soon.`,
        link: `/dashboard/projects/${proposal.project_id}?scheduling=pending#scheduling`,
        projectId: proposal.project_id,
      });
    } else if (isAdmin && proposal.proposed_by === "client") {
      await notifyProjectClients({
        type: "schedule_change_requested",
        eventKey: "shoot_time_declined",
        title: "Shoot time declined",
        body: `Your suggested shoot time (${dateStr}) was declined. You can suggest another time in your portal.`,
        link: `/dashboard/projects/${proposal.project_id}?scheduling=pending#scheduling`,
        projectId: proposal.project_id,
      });
    } else if (!isAdmin && proposal.proposed_by === "admin") {
      await notifyAdmins({
        type: "schedule_change_requested",
        eventKey: "shoot_time_declined",
        title: "Client declined shoot time",
        body: `The client declined the proposed shoot time: ${dateStr}`,
        link: `/admin/projects/${proposal.project_id}#scheduling`,
        projectId: proposal.project_id,
      });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
