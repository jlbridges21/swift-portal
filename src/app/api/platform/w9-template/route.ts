import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { listW9Templates, rollbackW9Template, saveW9Template } from "@/lib/w9-template";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const templates = await listW9Templates();
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Could not list W-9 templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const revision = typeof form?.get("revision") === "string" ? String(form.get("revision")).trim() : "";
  if (!(file instanceof File) || file.size > 2_000_000) {
    return NextResponse.json({ error: "Upload the IRS W-9 PDF (under 2 MB)." }, { status: 400 });
  }
  if (file.size < 100) {
    return NextResponse.json({ error: "Upload the IRS W-9 PDF." }, { status: 400 });
  }
  if (!revision || revision.length > 40) {
    return NextResponse.json({ error: "Enter a revision label, up to 40 characters." }, { status: 400 });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await saveW9Template({
      bytes,
      revisionLabel: revision,
      uploadedBy: auth.profile.id,
    });
    const templates = await listW9Templates();
    return NextResponse.json({ ok: true, id: saved.id, templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.startsWith("This PDF is missing") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Choose a revision to restore." }, { status: 400 });
  try {
    await rollbackW9Template(body.id);
    const templates = await listW9Templates();
    return NextResponse.json({ ok: true, templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
