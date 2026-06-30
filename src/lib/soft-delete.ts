import { createServiceClient } from "@/lib/supabase/server";

export async function softDeleteClient(clientId: string, adminUserId: string): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data: junction } = await supabase
    .from("project_clients")
    .select("project_id")
    .eq("client_id", clientId);

  const projectIds = new Set<string>(junction?.map((row) => row.project_id) ?? []);

  const { data: ownedProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .is("deleted_at", null);

  ownedProjects?.forEach((p) => projectIds.add(p.id));

  const { error: clientError } = await supabase
    .from("clients")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("id", clientId)
    .is("deleted_at", null);

  if (clientError) {
    throw new Error(clientError.message);
  }

  if (projectIds.size) {
    const { error: projectError } = await supabase
      .from("projects")
      .update({ deleted_at: now, deleted_by: adminUserId })
      .in("id", Array.from(projectIds))
      .is("deleted_at", null);

    if (projectError) {
      throw new Error(projectError.message);
    }
  }

  await supabase
    .from("properties")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("client_id", clientId)
    .is("deleted_at", null);

  if (projectIds.size) {
    await supabase
      .from("leads")
      .update({ deleted_at: now, deleted_by: adminUserId })
      .in("project_id", Array.from(projectIds))
      .is("deleted_at", null);
  }
}

export async function restoreClient(clientId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { data: junction } = await supabase
    .from("project_clients")
    .select("project_id")
    .eq("client_id", clientId);

  const projectIds = new Set<string>(junction?.map((row) => row.project_id) ?? []);
  const { data: ownedProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientId);
  ownedProjects?.forEach((p) => projectIds.add(p.id));

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", clientId);

  if (error) {
    throw new Error(error.message);
  }

  if (projectIds.size) {
    await supabase
      .from("projects")
      .update({ deleted_at: null, deleted_by: null })
      .in("id", Array.from(projectIds));

    await supabase
      .from("properties")
      .update({ deleted_at: null, deleted_by: null })
      .eq("client_id", clientId);
  }
}

export async function softDeleteProject(projectId: string, adminUserId: string): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: now, deleted_by: adminUserId })
    .eq("id", projectId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function restoreProject(projectId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}
