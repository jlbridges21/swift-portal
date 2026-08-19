import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export class TenantRecordNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "TenantRecordNotFoundError";
  }
}

export async function softDeleteClient(
  clientId: string,
  adminUserId: string,
  businessId: string
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const now = new Date().toISOString();

  const { data: junction } = await db
    .from("project_clients")
    .select("project_id, is_primary")
    .eq("client_id", clientId);

  const candidateIds = new Set<string>(junction?.map((row) => row.project_id) ?? []);

  const { data: ownedProjects } = await db
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .is("deleted_at", null);

  ownedProjects?.forEach((p) => candidateIds.add(p.id));

  const projectIdsToDelete: string[] = [];

  for (const projectId of candidateIds) {
    const { data: allAssignees } = await db
      .from("project_clients")
      .select("id, client_id, is_primary")
      .eq("project_id", projectId);

    const others = (allAssignees ?? []).filter((a) => a.client_id !== clientId);

    if (others.length === 0) {
      // Sole assignee — soft-delete the project with the client
      projectIdsToDelete.push(projectId);
      continue;
    }

    // Shared project — remove this client and keep the project for others
    await db
      .from("project_clients")
      .delete()
      .eq("project_id", projectId)
      .eq("client_id", clientId);

    const wasPrimary =
      (allAssignees ?? []).some((a) => a.client_id === clientId && a.is_primary) ||
      ownedProjects?.some((p) => p.id === projectId);

    if (wasPrimary) {
      const nextPrimary = others[0];
      await db
        .from("project_clients")
        .update({ is_primary: true })
        .eq("id", nextPrimary.id);
      await db
        .from("projects")
        .update({ client_id: nextPrimary.client_id })
        .eq("id", projectId);
    }
  }

  const { data: deletedClient, error: clientError } = await db
    .from("clients")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("id", clientId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }
  if (!deletedClient) {
    throw new TenantRecordNotFoundError("Client not found");
  }

  if (projectIdsToDelete.length) {
    const { error: projectError } = await db
      .from("projects")
      .update({ deleted_at: now, deleted_by: adminUserId })
      .in("id", projectIdsToDelete)
      .is("deleted_at", null);

    if (projectError) {
      throw new Error(projectError.message);
    }
  }

  await db
    .from("properties")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("client_id", clientId)
    .is("deleted_at", null);

  if (projectIdsToDelete.length) {
    await db
      .from("leads")
      .update({ deleted_at: now, deleted_by: adminUserId })
      .in("project_id", projectIdsToDelete)
      .is("deleted_at", null);
  }
}

export async function restoreClient(clientId: string, businessId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);

  const { data: junction } = await db
    .from("project_clients")
    .select("project_id")
    .eq("client_id", clientId);

  const projectIds = new Set<string>(junction?.map((row) => row.project_id) ?? []);
  const { data: ownedProjects } = await db
    .from("projects")
    .select("id")
    .eq("client_id", clientId);
  ownedProjects?.forEach((p) => projectIds.add(p.id));

  const { error } = await db
    .from("clients")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", clientId);

  if (error) {
    throw new Error(error.message);
  }

  if (projectIds.size) {
    await db
      .from("projects")
      .update({ deleted_at: null, deleted_by: null })
      .in("id", Array.from(projectIds));

    await db
      .from("properties")
      .update({ deleted_at: null, deleted_by: null })
      .eq("client_id", clientId);
  }
}

export async function softDeleteProject(
  projectId: string,
  adminUserId: string,
  businessId: string
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("projects")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("id", projectId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new TenantRecordNotFoundError("Project not found");
  }
}

export async function restoreProject(projectId: string, businessId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);

  const { error } = await db
    .from("projects")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}
