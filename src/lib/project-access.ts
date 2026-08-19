import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Verify the current user can access a project (RLS + business_id). */
export async function canAccessProject(
  profile: Profile,
  projectId: string
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase.from("projects").select("id").eq("id", projectId).is("deleted_at", null);
  if (profile.business_id) {
    query = query.eq("business_id", profile.business_id);
  }

  const { data } = await query.maybeSingle();
  return !!data;
}
