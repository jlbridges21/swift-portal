import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getProjectEmailEvents, buildEmailCommunicationSummaries } from "@/lib/email-analytics";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const events = await getProjectEmailEvents(id);
    return NextResponse.json({ groups: buildEmailCommunicationSummaries(events) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
