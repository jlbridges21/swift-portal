import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { deleteExpenseEntry } from "@/lib/platform-economics";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteExpenseEntry(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
