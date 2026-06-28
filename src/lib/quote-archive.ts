import type { SupabaseClient } from "@supabase/supabase-js";
import { ARCHIVED_QUOTE_NOTE } from "@/lib/quote-display";

/** Mark older official proposals as archived so only the newest is shown in the UI. */
export async function archivePreviousOfficialQuotes(
  supabase: SupabaseClient,
  projectId: string,
  keepQuoteId: string
) {
  await supabase
    .from("project_quotes")
    .update({ status: "draft", notes: ARCHIVED_QUOTE_NOTE })
    .eq("project_id", projectId)
    .eq("quote_kind", "official")
    .neq("id", keepQuoteId);
}
