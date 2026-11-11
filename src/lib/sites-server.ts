import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import { brandedListingUrl, fallbackListingPath, listingDomainConnected } from "@/lib/marketing/listing-url";
import { buildPublicTenantUrlForBusiness } from "@/lib/project-link-access";

/**
 * Sites → Property Websites library.
 *
 * One row per eligible project (every project that is not deleted — the same rule the project
 * page uses to show its Marketing Kit card), joined to its Marketing Kit row when one exists.
 * The library is read-only: it never creates a kit row (the Marketing Kit editor does that when
 * opened) and never publishes anything.
 *
 * Status is exactly two states, from the existing publishing system:
 *   live         marketing_kits.website_status === "published"
 *   unpublished  everything else (no kit yet, draft, or taken down)
 */
export type PropertyWebsiteStatus = "live" | "unpublished";

export type PropertyWebsiteRow = {
  projectId: string;
  /** Property address when known, else the project name. */
  title: string;
  projectName: string;
  address: string | null;
  clientName: string | null;
  status: PropertyWebsiteStatus;
  /** A Marketing Kit row exists (the website has been opened/configured at least once). */
  configured: boolean;
  /** Public address — only for live websites. Never invented for unpublished ones. */
  liveUrl: string | null;
  /** Last edit to the website, else publish time, else the project's own update time. */
  updatedAt: string | null;
  views: number;
  heroUrl: string | null;
};

export type PropertyWebsitesResult =
  | { ok: true; rows: PropertyWebsiteRow[]; setupRequired: boolean }
  | { ok: false };

type ProjectJoinRow = {
  id: string;
  project_name: string;
  property_address: string | null;
  cover_image_id: string | null;
  cover_image_url: string | null;
  updated_at: string | null;
  created_at: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
};

type KitRow = {
  project_id: string;
  site_slug: string | null;
  website_status: string;
  published_at: string | null;
  draft_updated_at: string | null;
  view_count: number | null;
};

const PROJECT_LIMIT = 1000;

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(message && /does not exist|schema cache|PGRST205|42P01/i.test(message));
}

function latest(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (!best || new Date(v).getTime() > new Date(best).getTime())) best = v;
  }
  return best;
}

export async function loadPropertyWebsites(businessId: string): Promise<PropertyWebsitesResult> {
  const db = await createTenantServiceClient(businessId);
  const [projectsRes, kitsRes, bizRes] = await Promise.all([
    db
      .from("projects")
      .select("id, project_name, property_address, cover_image_id, cover_image_url, updated_at, created_at, clients(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(PROJECT_LIMIT),
    db
      .from("marketing_kits")
      .select("project_id, site_slug, website_status, published_at, draft_updated_at, view_count")
      .limit(PROJECT_LIMIT * 2),
    db.raw
      .from("businesses")
      .select("slug, custom_domain, listing_domain, listing_domain_status, listing_domain_vercel_verified, listing_domain_misconfigured")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  if (projectsRes.error) {
    console.error("[sites] projects failed", projectsRes.error.message);
    return { ok: false };
  }
  // Marketing Kit schema not applied yet: every project is still listed, all Unpublished.
  const setupRequired = Boolean(kitsRes.error && isMissingRelation(kitsRes.error.message));
  if (kitsRes.error && !setupRequired) {
    console.error("[sites] marketing kits failed", kitsRes.error.message);
    return { ok: false };
  }

  const projects = (projectsRes.data ?? []) as unknown as ProjectJoinRow[];
  const kitByProject = new Map<string, KitRow>();
  for (const k of ((kitsRes.data ?? []) as KitRow[])) kitByProject.set(k.project_id, k);

  // Listing-domain columns may be missing on older schemas — fall back to the portal address.
  const bizRow = (bizRes.error ? null : bizRes.data) as
    | (Parameters<typeof listingDomainConnected>[0] & { slug: string; custom_domain: string | null; listing_domain: string | null })
    | null;
  const branded = bizRow && listingDomainConnected(bizRow) ? bizRow.listing_domain : null;
  let tenantBase: { slug: string; custom_domain: string | null } | null = bizRow
    ? { slug: bizRow.slug, custom_domain: bizRow.custom_domain }
    : null;
  if (!tenantBase) {
    const { data } = await db.raw.from("businesses").select("slug, custom_domain").eq("id", businessId).maybeSingle();
    tenantBase = (data as { slug: string; custom_domain: string | null } | null) ?? { slug: "", custom_domain: null };
  }

  const heroMap = await getProjectHeroPosterUrlMap(
    projects.map((p) => ({ id: p.id, cover_image_id: p.cover_image_id, cover_image_url: p.cover_image_url })),
    businessId
  ).catch(() => ({}) as Record<string, string | null>);

  const rows = await Promise.all(
    projects.map(async (p): Promise<PropertyWebsiteRow> => {
      const kit = kitByProject.get(p.id) ?? null;
      const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
      const live = kit?.website_status === "published" && Boolean(kit.site_slug);
      let liveUrl: string | null = null;
      if (live && kit?.site_slug) {
        liveUrl = branded
          ? brandedListingUrl(branded, kit.site_slug)
          : await buildPublicTenantUrlForBusiness(businessId, tenantBase!, fallbackListingPath(kit.site_slug)).catch(() => null);
      }
      const address = p.property_address?.trim() || null;
      return {
        projectId: p.id,
        title: address || p.project_name || "Untitled project",
        projectName: p.project_name || address || "Untitled project",
        address,
        clientName: client?.name ?? null,
        status: live ? "live" : "unpublished",
        configured: Boolean(kit),
        liveUrl,
        updatedAt: kit ? latest(kit.draft_updated_at, kit.published_at) ?? p.updated_at : p.updated_at ?? p.created_at,
        views: Number(kit?.view_count) || 0,
        heroUrl: heroMap[p.id] ?? null,
      };
    })
  );

  // Live first, then websites already started, then the rest — each newest first.
  const rank = (r: PropertyWebsiteRow) => (r.status === "live" ? 0 : r.configured ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()));

  return { ok: true, rows, setupRequired };
}
