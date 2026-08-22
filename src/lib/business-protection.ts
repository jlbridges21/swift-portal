import { createServiceClient } from "@/lib/supabase/server";

/** Platform delete/restore guard — reads businesses.is_protected. */
export async function isBusinessProtected(businessId: string): Promise<boolean> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("businesses")
    .select("is_protected")
    .eq("id", businessId)
    .maybeSingle();
  if (error) {
    console.error("[isBusinessProtected]", error.message);
    // Fail closed: if we cannot read the flag, refuse destructive ops.
    return true;
  }
  return data?.is_protected === true;
}
