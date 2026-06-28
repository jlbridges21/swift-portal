/** User-facing media label: prefer custom title over original upload filename. */
export function mediaDisplayName(asset: {
  title?: string | null;
  file_name?: string | null;
}): string {
  const title = asset.title?.trim();
  if (title) return title;
  const fileName = asset.file_name?.trim();
  if (fileName) return fileName;
  return "Untitled";
}
