/**
 * Default project documents — constants, types and validation shared by the
 * settings card (client) and the API / project-creation code (server).
 */
import { sanitizeStorageFileName } from "@/lib/media-upload";

export const DEFAULT_DOCUMENTS_BUCKET = "project-documents";

/** 25MB — standard business documents; uploaded with a single signed PUT. */
export const MAX_DEFAULT_DOCUMENT_BYTES = 25 * 1024 * 1024;

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
};

export const DEFAULT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
] as const;

/** `accept` attribute for the settings file input. */
export const DEFAULT_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.zip," + DEFAULT_DOCUMENT_MIME_TYPES.join(",");

export type DefaultProjectDocument = {
  id: string;
  business_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

/** Prefer the extension: browsers often send octet-stream or nothing for .doc/.docx. */
export function resolveDefaultDocumentMime(fileName: string, declared?: string | null): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExt = EXTENSION_MIME[ext];
  if (byExt) return byExt;
  const d = declared?.trim().toLowerCase();
  if (d && (DEFAULT_DOCUMENT_MIME_TYPES as readonly string[]).includes(d)) return d;
  return null;
}

export function validateDefaultDocument(input: {
  fileName: string;
  mimeType?: string | null;
  fileSize: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  const mimeType = resolveDefaultDocumentMime(input.fileName, input.mimeType);
  if (!mimeType) {
    return { ok: false, error: `${input.fileName}: only PDF, Word (.doc, .docx) or ZIP files are supported.` };
  }
  if (!(input.fileSize > 0)) return { ok: false, error: `${input.fileName}: file is empty.` };
  if (input.fileSize > MAX_DEFAULT_DOCUMENT_BYTES) {
    return { ok: false, error: `${input.fileName} is larger than 25 MB.` };
  }
  return { ok: true, mimeType };
}

export function buildDefaultDocumentPath(businessId: string, fileName: string): string {
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${sanitizeStorageFileName(fileName)}`;
  return `${businessId}/default-documents/${unique}`;
}

export function isDefaultDocumentPath(filePath: string, businessId: string): boolean {
  return Boolean(businessId) && filePath.startsWith(`${businessId}/default-documents/`);
}

/** Table missing because v114 has not been applied yet. */
export function isMissingDefaultDocumentsTable(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("default_project_documents");
}
