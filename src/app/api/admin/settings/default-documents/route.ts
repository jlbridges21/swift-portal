import { NextResponse } from "next/server";
import {
  DEFAULT_DOCUMENTS_BUCKET,
  isDefaultDocumentPath,
  isMissingDefaultDocumentsTable,
  validateDefaultDocument,
  type DefaultProjectDocument,
} from "@/lib/default-project-documents";
import { verifyStorageObject } from "@/lib/upload/storage-verify";
import { MIGRATION_REQUIRED_MESSAGE, requireDefaultDocumentsAccess } from "./auth";

export async function GET() {
  const auth = await requireDefaultDocumentsAccess();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from("default_project_documents")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingDefaultDocumentsTable(error)) {
      return NextResponse.json({ documents: [], migrationRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}

/**
 * Save an uploaded file as a default document. With `replaceId`, swap the file
 * behind an existing default (projects already created keep their own copies).
 */
export async function POST(request: Request) {
  const auth = await requireDefaultDocumentsAccess();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { filePath?: string; fileName?: string; mimeType?: string; fileSize?: number; replaceId?: string }
    | null;
  if (!body?.filePath || !body.fileName || body.fileSize == null) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!isDefaultDocumentPath(body.filePath, auth.businessId)) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }
  const validation = validateDefaultDocument({
    fileName: body.fileName,
    mimeType: body.mimeType,
    fileSize: Number(body.fileSize),
  });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const verify = await verifyStorageObject(auth.db.raw, DEFAULT_DOCUMENTS_BUCKET, body.filePath, {
    fileName: body.fileName,
  });
  if (!verify.ok) return NextResponse.json({ error: verify.error }, { status: 400 });

  const fields = {
    title: body.fileName,
    file_name: body.fileName,
    file_path: body.filePath,
    file_size: Number(body.fileSize),
    mime_type: validation.mimeType,
  };
  const discardUpload = () =>
    auth.db.raw.storage.from(DEFAULT_DOCUMENTS_BUCKET).remove([body.filePath!]);

  if (body.replaceId) {
    const { data: existing, error: findErr } = await auth.db
      .from("default_project_documents")
      .select("*")
      .eq("id", body.replaceId)
      .maybeSingle();
    if (findErr || !existing) {
      await discardUpload();
      if (isMissingDefaultDocumentsTable(findErr)) {
        return NextResponse.json({ error: MIGRATION_REQUIRED_MESSAGE }, { status: 409 });
      }
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    const { data, error } = await auth.db
      .from("default_project_documents")
      .update(fields)
      .eq("id", body.replaceId)
      .select()
      .single();
    if (error) {
      await discardUpload();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const old = existing as DefaultProjectDocument;
    if (old.file_path !== body.filePath) {
      await auth.db.raw.storage.from(DEFAULT_DOCUMENTS_BUCKET).remove([old.file_path]);
    }
    return NextResponse.json({ document: data });
  }

  const { count } = await auth.db
    .from("default_project_documents")
    .select("id", { count: "exact", head: true });
  const { data, error } = await auth.db
    .from("default_project_documents")
    .insert({ ...fields, display_order: count ?? 0 })
    .select()
    .single();
  if (error) {
    await discardUpload();
    if (isMissingDefaultDocumentsTable(error)) {
      return NextResponse.json({ error: MIGRATION_REQUIRED_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ document: data });
}
