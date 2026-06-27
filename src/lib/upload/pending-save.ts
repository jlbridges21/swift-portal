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
  binaryUploaded?: boolean;
  skipStorageVerify?: boolean;
  failedStep?: string;
}

export { UploadSaveError, UploadBinaryError, type UploadTechnicalDetails } from "./upload-errors";
