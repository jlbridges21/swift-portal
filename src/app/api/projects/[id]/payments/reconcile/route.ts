import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { requireTenantContext } from "@/lib/tenant";
import {
  reconcileProjectOutstandingPayments,
  type ReconcileProjectResult,
} from "@/lib/stripe-payment-reconcile";

export const runtime = "nodejs";

async function authorizeProject(projectId: string) {
  const profile = await getProfile();
  if (!profile) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const allowed = await canAccessProject(profile, projectId);
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const tenant = await requireTenantContext();
  return { ok: true as const, profile, tenant };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await authorizeProject(projectId);
    if (!auth.ok) return auth.response;

    const result: ReconcileProjectResult = await reconcileProjectOutstandingPayments(
      projectId,
      auth.tenant.businessId,
      "project_api"
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[projects/payments/reconcile] POST error:", err);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(_request, { params });
}
