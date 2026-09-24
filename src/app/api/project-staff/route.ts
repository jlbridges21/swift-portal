import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessProject } from "@/lib/project-access";
import {
  assignProjectStaff,
  listAssignableStaff,
  listProjectStaff,
  removeProjectStaff,
} from "@/lib/staff";

/** Project staff assignment — requires projects.manage_staff. */

export async function GET(request: Request) {
  const auth = await requireAdminApi({ permission: "projects.manage_staff" });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id")?.trim() || "";
  if (!projectId) {
    return NextResponse.json({ error: "project_id required." }, { status: 400 });
  }

  if (!(await canAccessProject(auth.profile, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [assigned, assignable] = await Promise.all([
    listProjectStaff(tenant.businessId, projectId),
    listAssignableStaff(tenant.businessId),
  ]);

  return NextResponse.json({ assigned, assignable });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi({ permission: "projects.manage_staff" });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json().catch(() => ({}))) as {
    project_id?: string;
    user_id?: string;
  };
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!projectId || !userId) {
    return NextResponse.json({ error: "project_id and user_id required." }, { status: 400 });
  }

  if (!(await canAccessProject(auth.profile, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await assignProjectStaff({
    businessId: tenant.businessId,
    projectId,
    userId,
    actor: { id: auth.profile.id, email: auth.profile.email },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi({ permission: "projects.manage_staff" });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id")?.trim() || "";
  const userId = url.searchParams.get("user_id")?.trim() || "";
  if (!projectId || !userId) {
    return NextResponse.json({ error: "project_id and user_id required." }, { status: 400 });
  }

  if (!(await canAccessProject(auth.profile, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await removeProjectStaff({
    businessId: tenant.businessId,
    projectId,
    userId,
    actor: { id: auth.profile.id, email: auth.profile.email },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
