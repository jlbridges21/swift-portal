import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildCommunicationTimeline,
  filterCommunicationActivities,
  type ProjectNotificationRow,
} from "@/lib/communications";
import {
  buildEmailCommunicationSummaries,
  getProjectEmailEvents,
} from "@/lib/email-analytics";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = await createServiceClient();

    const [{ data: notifications }, { data: activities }, emailEvents] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, type, title, body, link, created_at, user_id, profiles(email, full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_logs")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      getProjectEmailEvents(id),
    ]);

    const emails = buildEmailCommunicationSummaries(emailEvents);

    const notificationRows: ProjectNotificationRow[] = (notifications ?? []).map((row) => {
      const profile = row.profiles as { email?: string; full_name?: string } | null;
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        created_at: row.created_at,
        user_id: row.user_id,
        recipient_email: profile?.email ?? null,
        recipient_name: profile?.full_name ?? null,
      };
    });

    const commActivities = filterCommunicationActivities(activities ?? []);
    const timeline = buildCommunicationTimeline(emails, notificationRows, commActivities);

    return NextResponse.json({
      emails,
      notifications: notificationRows,
      activities: commActivities,
      timeline,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
