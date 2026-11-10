import type { AssetRef } from "@/lib/marketing/model";
import type { KitClientState } from "@/lib/marketing/server";
import type { UrlResolver } from "@/lib/marketing/view-model";

/**
 * Media URLs for the draft (editor) website: the signed-in `/api/marketing/{projectId}` routes,
 * which check the viewer's project access on every request. Used by the editor's live preview
 * and the full-page draft preview, never by the public site.
 */
export function editorUrls(state: Pick<KitClientState, "projectId" | "media" | "businessLogoUrl">): UrlResolver {
  const base = `/api/marketing/${state.projectId}`;
  const posters = new Map(state.media.map((m) => [m.id, m]));
  return {
    image: (ref: AssetRef, size) =>
      ref.kind === "media"
        ? `${base}/img/${ref.id}?s=${size}`
        : ref.kind === "upload"
          ? `${base}/img/u?p=${encodeURIComponent(ref.path)}&s=${size}`
          : state.businessLogoUrl,
    video: (id) => `${base}/video/${id}`,
    logo: (ref: AssetRef) =>
      ref.kind === "upload"
        ? `${base}/logo?p=${encodeURIComponent(ref.path)}`
        : ref.kind === "business_logo"
          ? state.businessLogoUrl
            ? `${base}/logo?ref=business`
            : null
          : `${base}/img/${ref.id}?s=thumb`,
    poster: (id) => {
      const m = posters.get(id);
      if (!m) return null;
      return m.source === "youtube" ? m.posterUrl : `${base}/img/${id}?s=medium`;
    },
  };
}
