export interface PendingSavePayload {
  projectId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: "photo" | "video" | "document";
  displayOrder: number;
}

export class UploadSaveError extends Error {
  readonly pendingSave: PendingSavePayload;
  readonly step?: string;
  readonly statusCode?: number;

  constructor(message: string, pendingSave: PendingSavePayload, meta?: { step?: string; statusCode?: number }) {
    super(message);
    this.name = "UploadSaveError";
    this.pendingSave = pendingSave;
    this.step = meta?.step;
    this.statusCode = meta?.statusCode;
  }
}
