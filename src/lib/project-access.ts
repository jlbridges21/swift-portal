import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Verify the current user can access a project (RLS-enforced). */
export async function canAccessProject(
  profile: Profile,
  projectId: string
): Promise<boolean> {
  if (profile.role === "admin") return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  return !!data;
}
