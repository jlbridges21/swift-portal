import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { deliverProjectToClient, loadDeliverySummary } from "@/lib/project-delivery";

export const dynamic = "force-dynamic";

async function authorize(projectId: string) {
  const profile = await getProfile();
  if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {
    return { error: NextResponse.json({ error: "You don't have permission to send projects to clients." }, { status: 403 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };
  if (!(await canAccessProject(profile, projectId))) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { profile, businessId: tenant.businessId };
}

/** What the client will get: recipient, media counts, payment and download state, last send. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  try {
    const summary = await loadDeliverySummary(auth.businessId, id);
    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[deliver] summary failed", err);
    return NextResponse.json({ error: "Couldn't load delivery details." }, { status: 500 });
  }
}

/**
 * { action: "send", markDelivered?, note? } — email the client a one-click link.
 * { action: "link" } — mint the same link to copy and send another way.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; markDelivered?: unknown; note?: unknown };
  if (body.action !== "send" && body.action !== "link") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  try {
    const result = await deliverProjectToClient({
      businessId: auth.businessId,
      projectId: id,
      actorId: auth.profile.id,
      send: body.action === "send",
      markDelivered: body.markDelivered === true,
      note: typeof body.note === "string" ? body.note : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[deliver] failed", err);
    return NextResponse.json({ error: "Something went wrong sending this project. Please try again." }, { status: 500 });
  }
}
