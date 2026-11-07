import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { createExpenseEntry, listExpenseEntries, parseExpenseInput } from "@/lib/platform-economics";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ entries: (await listExpenseEntries()) ?? [] });
}

/** Record an actual provider invoice line (e.g. Supabase egress for 2026-10). */
export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const input = parseExpenseInput(await request.json().catch(() => ({})));
    await createExpenseEntry(input, auth.profile.email ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}
