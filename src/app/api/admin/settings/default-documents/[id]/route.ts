import { NextResponse } from "next/server";
import { DEFAULT_DOCUMENTS_BUCKET, type DefaultProjectDocument } from "@/lib/default-project-documents";
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireDefaultDocumentsAccess } from "../auth";

type Ctx = { params: Promise<{ id: string }> };

async function findDocument(db: TenantServiceClient, id: string) {
  const { data } = await db.from("default_project_documents").select("*").eq("id", id).maybeSingle();
  return (data as DefaultProjectDocument | null) ?? null;
}

/** Short-lived signed URL to view (inline) or download (?download=1) a default document. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireDefaultDocumentsAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const doc = await findDocument(auth.db, id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await auth.db.raw.storage
    .from(DEFAULT_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, 300, download ? { download: doc.file_name } : undefined);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not open document." }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}

/** Remove a default. Copies already added to projects are separate files and stay. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireDefaultDocumentsAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const doc = await findDocument(auth.db, id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await auth.db.from("default_project_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.db.raw.storage.from(DEFAULT_DOCUMENTS_BUCKET).remove([doc.file_path]);
  return NextResponse.json({ ok: true });
}
