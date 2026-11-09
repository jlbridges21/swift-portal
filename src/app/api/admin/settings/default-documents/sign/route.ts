import { NextResponse } from "next/server";
import {
  DEFAULT_DOCUMENTS_BUCKET,
  buildDefaultDocumentPath,
  validateDefaultDocument,
} from "@/lib/default-project-documents";
import { requireDefaultDocumentsAccess } from "../auth";

/** Mint a signed upload URL for one default document. */
export async function POST(request: Request) {
  const auth = await requireDefaultDocumentsAccess();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { fileName?: string; mimeType?: string; fileSize?: number }
    | null;
  if (!body?.fileName || body.fileSize == null) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  const validation = validateDefaultDocument({
    fileName: body.fileName,
    mimeType: body.mimeType,
    fileSize: Number(body.fileSize),
  });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const filePath = buildDefaultDocumentPath(auth.businessId, body.fileName);
  const { data, error } = await auth.db.raw.storage
    .from(DEFAULT_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(filePath);
  if (error || !data) {
    console.error("[default-documents/sign]", error?.message);
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl, filePath, mimeType: validation.mimeType });
}
