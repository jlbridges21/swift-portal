/**
 * Per-project client media section visibility.
 *
 * Single resolver for UI gating AND download/ZIP/thumbnail paths.
 * Admins always see and can download everything; non-admins only see
 * sections that are ON for the project.
 */

export type MediaSectionKey = "photos" | "videos" | "tours" | "models" | "documents";

export type ProjectMediaSections = {
  photos: boolean;
  videos: boolean;
  tours: boolean;
  models: boolean;
  documents: boolean;
};

/** Matches today's product: every section visible. */
export const DEFAULT_PROJECT_MEDIA_SECTIONS: ProjectMediaSections = {
  photos: true,
  videos: true,
  tours: true,
  models: true,
  documents: true,
};

export const MEDIA_SECTION_KEYS: MediaSectionKey[] = [
  "photos",
  "videos",
  "tours",
  "models",
  "documents",
];

export const MEDIA_SECTION_LABELS: Record<MediaSectionKey, string> = {
  photos: "Photo Gallery",
  videos: "Video",
  tours: "360° Virtual Tours",
  models: "3D Models",
  documents: "Documents",
};

export type ProjectMediaSectionColumns = {
  client_section_photos?: boolean | null;
  client_section_videos?: boolean | null;
  client_section_tours?: boolean | null;
  client_section_models?: boolean | null;
  client_section_documents?: boolean | null;
};

export function normalizeProjectMediaSections(
  raw?: Partial<ProjectMediaSections> | null
): ProjectMediaSections {
  return {
    photos: raw?.photos !== false,
    videos: raw?.videos !== false,
    tours: raw?.tours !== false,
    models: raw?.models !== false,
    documents: raw?.documents !== false,
  };
}

export function mediaSectionsFromProject(
  project?: ProjectMediaSectionColumns | null
): ProjectMediaSections {
  if (!project) return { ...DEFAULT_PROJECT_MEDIA_SECTIONS };
  return {
    photos: project.client_section_photos !== false,
    videos: project.client_section_videos !== false,
    tours: project.client_section_tours !== false,
    models: project.client_section_models !== false,
    documents: project.client_section_documents !== false,
  };
}

export function projectColumnsFromMediaSections(
  sections: ProjectMediaSections
): Required<ProjectMediaSectionColumns> {
  return {
    client_section_photos: sections.photos,
    client_section_videos: sections.videos,
    client_section_tours: sections.tours,
    client_section_models: sections.models,
    client_section_documents: sections.documents,
  };
}

export function isMediaSectionVisibleForClient(
  sections: ProjectMediaSections,
  key: MediaSectionKey
): boolean {
  return sections[key] !== false;
}

/** Map a media asset to its client-facing section (tours/models are not media_assets). */
export function mediaTypeToSection(
  mediaType: string | null | undefined
): Exclude<MediaSectionKey, "tours" | "models"> | null {
  if (mediaType === "photo") return "photos";
  if (mediaType === "video") return "videos";
  if (mediaType === "document") return "documents";
  return null;
}

/**
 * Filter media for non-admin viewers by project section visibility.
 * Admins get the input unchanged.
 */
export function filterMediaByClientSections<
  T extends { media_type?: string | null },
>(media: T[], sections: ProjectMediaSections, isAdmin: boolean): T[] {
  if (isAdmin) return media;
  return media.filter((asset) => {
    const key = mediaTypeToSection(asset.media_type);
    if (!key) return false;
    return isMediaSectionVisibleForClient(sections, key);
  });
}

export function filterToursByClientSections<T>(
  tours: T[],
  sections: ProjectMediaSections,
  isAdmin: boolean
): T[] {
  if (isAdmin) return tours;
  if (!isMediaSectionVisibleForClient(sections, "tours")) return [];
  return tours;
}

export function filterModelsByClientSections<T>(
  models: T[],
  sections: ProjectMediaSections,
  isAdmin: boolean
): T[] {
  if (isAdmin) return models;
  if (!isMediaSectionVisibleForClient(sections, "models")) return [];
  return models;
}

/**
 * Whether a non-admin may access this media asset for download / thumb / preview.
 * Admins always may.
 */
export function clientMayAccessMediaSection(
  sections: ProjectMediaSections,
  mediaType: string | null | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  const key = mediaTypeToSection(mediaType);
  if (!key) return false;
  return isMediaSectionVisibleForClient(sections, key);
}

export function anyClientMediaSectionVisible(sections: ProjectMediaSections): boolean {
  return MEDIA_SECTION_KEYS.some((k) => isMediaSectionVisibleForClient(sections, k));
}

export function parseMediaSectionsPatch(
  body: unknown
): ProjectMediaSections | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const hasAny =
    "photos" in o ||
    "videos" in o ||
    "tours" in o ||
    "models" in o ||
    "documents" in o;
  if (!hasAny) return null;
  return normalizeProjectMediaSections({
    photos: typeof o.photos === "boolean" ? o.photos : undefined,
    videos: typeof o.videos === "boolean" ? o.videos : undefined,
    tours: typeof o.tours === "boolean" ? o.tours : undefined,
    models: typeof o.models === "boolean" ? o.models : undefined,
    documents: typeof o.documents === "boolean" ? o.documents : undefined,
  });
}
