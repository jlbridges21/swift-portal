import { UploadBinaryError, UploadSaveError, userFacingUploadError } from "./upload-errors";

export function getUploadErrorMessage(
  error: unknown,
  context?: { phase?: string; status?: number; step?: string }
): string {
  if (error instanceof UploadSaveError || error instanceof UploadBinaryError) {
    return userFacingUploadError(error.technical);
  }

  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const status = context?.status ?? (error as { status?: number }).status;

  if (context?.step === "storage_verify" || /not visible yet|retry save/i.test(raw)) {
    return raw;
  }
  if (status === 413 || /too large|exceeds/i.test(raw)) {
    return "File exceeds maximum size for this media type.";
  }
  if (/unsupported|mime|file type/i.test(raw)) {
    return "Unsupported video format. Use MP4, MOV, or M4V.";
  }
  if (/network|failed to fetch|connection/i.test(raw)) {
    return "Network interrupted. Check your connection and try again.";
  }
  if (/unauthorized|session expired/i.test(raw) || status === 401 || status === 403) {
    return "Session expired. Refresh the page and sign in again.";
  }

  return raw.length > 200 ? `${raw.slice(0, 197)}…` : raw;
}

/** Always log full technical error; return user-facing message. */
export function normalizeUploadFailure(error: unknown): {
  userMessage: string;
  technical?: UploadBinaryError | UploadSaveError;
} {
  if (error instanceof UploadBinaryError || error instanceof UploadSaveError) {
    return { userMessage: userFacingUploadError(error.technical), technical: error };
  }
  const raw = error instanceof Error ? error.message : String(error);
  return { userMessage: getUploadErrorMessage(error), technical: undefined };
}
