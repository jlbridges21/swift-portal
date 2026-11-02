import { createClient } from "@/lib/supabase/server";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import { isOwnerAdmin, staffCan, visibleClientIdsFor } from "@/lib/staff-access";
import type { ClientViewClient, ProjectClientMap } from "@/lib/client-view";
import type { PipelineProjectRow } from "@/lib/admin-project-pipeline";
import type { Profile } from "@/lib/types";

export interface ClientViewData {
  clients: ClientViewClient[];
  projectClientIds: ProjectClientMap;
  heroUrls: Record<string, string | null>;
}

/**
 * Extra data the Client View needs on top of the pipeline projects. Only loaded
 * when the viewer has Client View on, so the Pipeline View costs nothing extra.
 *
 * `projects` must already be scoped to what the viewer may see (staff
 * visibility is applied by loadPipelinePageProjects).
 */
export async function loadClientViewData(options: {
  businessId: string;
  profile: Profile;
  projects: PipelineProjectRow[];
}): Promise<ClientViewData> {
  const { businessId, profile, projects } = options;
  const supabase = await createClient();
  const projectIds = projects.map((p) => p.id);

  const clientScope = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleClientIdsFor(businessId, profile);
  // Contact details live in the Clients area; staff without it see names only
  // (names already appear on pipeline cards).
  const canSeeContact = staffCan(profile, "area.clients");

  let clientsQuery = supabase
    .from("clients")
    .select("id, name, company, email, phone")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (clientScope !== "all") clientsQuery = clientsQuery.in("id", clientScope);

  const [{ data: clientRows }, { data: junction }, heroUrls] = await Promise.all([
    clientScope !== "all" && clientScope.length === 0
      ? Promise.resolve({ data: [] as Record<string, unknown>[] })
      : clientsQuery,
    projectIds.length
      ? supabase
          .from("project_clients")
          .select("project_id, client_id")
          .eq("business_id", businessId)
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; client_id: string }[] }),
    getProjectHeroPosterUrlMap(
      projects.map((p) => ({
        id: p.id,
        cover_image_id: p.cover_image_id ?? null,
        cover_image_url: p.cover_image_url ?? null,
      })),
      businessId
    ),
  ]);

  const projectClientIds: ProjectClientMap = {};
  for (const row of junction ?? []) {
    const pid = row.project_id as string;
    const cid = row.client_id as string | null;
    if (!cid) continue;
    (projectClientIds[pid] ??= []).push(cid);
  }

  const clients: ClientViewClient[] = (clientRows ?? []).map((c) => ({
    id: c.id as string,
    name: (c.name as string) || "Unnamed client",
    company: (c.company as string | null) ?? null,
    email: canSeeContact ? ((c.email as string | null) ?? null) : null,
    phone: canSeeContact ? ((c.phone as string | null) ?? null) : null,
  }));

  return { clients, projectClientIds, heroUrls };
}
