export type ResourceId =
  | "real-estate-photography-pricing-sheet"
  | "drone-photography-quote"
  | "photography-invoice"
  | "real-estate-photography-shot-list"
  | "drone-photography-business-plan"
  | "photography-client-questionnaire"
  | "photography-project-workflow-checklist";

export type BuiltFile = {
  format: "pdf" | "docx" | "xlsx";
  filename: string;
  bytes: Uint8Array;
  pages?: number;
  label: string;
};

export type ResourceBuild = {
  id: ResourceId;
  files: BuiltFile[];
  /** Filename of the PDF whose first page becomes the preview image. */
  previewFrom: string;
};

export const LABELS = {
  pdf: "Printable PDF",
  docx: "Editable Word / Google Docs (.docx)",
  xlsx: "Editable Excel / Google Sheets (.xlsx)",
} as const;

export const DISCLAIMER =
  "This template is a starting point, not legal, tax or financial advice. Requirements differ by location and business — check what applies to you, and have a qualified professional review your terms if you’re unsure.";
