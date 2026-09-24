import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  canAccessClient,
  isOwnerAdmin,
  visibleProjectIdsFor,
} from "@/lib/staff-access";

/** Projects linked to a client (primary or project_clients) for compose UI. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin({ area: "clients" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const { id: clientId } = await context.params;

    if (!(await canAccessClient(businessId, profile, clientId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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

    let rows = Array.from(byId.values());
    if (!isOwnerAdmin(profile)) {
      const visible = await visibleProjectIdsFor(businessId, profile);
      if (visible !== "all") {
        const set = new Set(visible);
        rows = rows.filter((r) => set.has(r.id));
      }
    }

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
