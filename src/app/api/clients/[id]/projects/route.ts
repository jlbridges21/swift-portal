import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

/** Projects linked to a client (primary or project_clients) for compose UI. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const { id: clientId } = await context.params;
    const db = await createTenantServiceClient(businessId);

    const { data: client } = await db
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [{ data: owned }, { data: junction }] = await Promise.all([
      db.from("projects").select("id, project_name").eq("client_id", clientId).order("updated_at", {
        ascending: false,
      }),
      db.from("project_clients").select("project_id, projects(id, project_name)").eq("client_id", clientId),
    ]);

    const byId = new Map<string, { id: string; project_name: string }>();
    for (const p of owned ?? []) {
      byId.set(p.id, { id: p.id, project_name: p.project_name });
    }
    for (const row of junction ?? []) {
      const proj = row.projects as unknown as { id: string; project_name: string } | null;
      if (proj?.id) byId.set(proj.id, { id: proj.id, project_name: proj.project_name });
    }

    return NextResponse.json(Array.from(byId.values()));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
