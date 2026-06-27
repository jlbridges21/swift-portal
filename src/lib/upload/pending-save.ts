export interface PendingSavePayload {
  projectId: string | null;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: "photo" | "video" | "document";
  displayOrder: number;
  title?: string;
  description?: string;
  tags?: string[];
  thumbnailPath?: string | null;
  /** Set when binary upload finished — retry may skip storage verify after first failure. */
  binaryUploaded?: boolean;
  skipStorageVerify?: boolean;
  /** Last failed save step from server (e.g. storage_verify). */
  failedStep?: string;
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
