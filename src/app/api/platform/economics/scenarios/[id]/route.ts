import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { deleteScenario, saveScenario } from "@/lib/platform-economics";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as { config?: unknown; description?: unknown };
    const scenario = await saveScenario({ id, config: body.config, description: body.description }, auth.profile.email ?? null);
    return NextResponse.json({ scenario });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteScenario(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
