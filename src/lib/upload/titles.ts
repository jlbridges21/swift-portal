/** Build display title for multi-file uploads: "Title", "Title-1", "Title-2", … */
export function resolveUploadTitle(baseTitle: string, fileIndex: number, totalFiles: number): string {
  const trimmed = baseTitle.trim();
  if (!trimmed) return trimmed;
  if (totalFiles <= 1) return trimmed;
  return `${trimmed}-${fileIndex + 1}`;
}
