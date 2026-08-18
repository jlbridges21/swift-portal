import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { ARCHIVED_QUOTE_NOTE, isArchivedQuote } from "@/lib/quote-display";
import type { ProjectQuote } from "@/lib/types";

/** Mark older official proposals as archived so only the newest is shown in the UI. */
export async function archivePreviousOfficialQuotes(
  businessId: string,
  projectId: string,
  keepQuoteId: string
) {
  const db = await createTenantServiceClient(businessId);
  const { data: previous } = await db
    .from("project_quotes")
    .select("id, notes")
    .eq("project_id", projectId)
    .eq("quote_kind", "official")
    .neq("id", keepQuoteId);

  for (const row of (previous ?? []) as Pick<ProjectQuote, "id" | "notes">[]) {
    if (isArchivedQuote(row)) continue;

    const notes = row.notes?.trim()
      ? `${ARCHIVED_QUOTE_NOTE}\n\n${row.notes.trim()}`
      : ARCHIVED_QUOTE_NOTE;

    await db
      .from("project_quotes")
      .update({ status: "draft", notes })
      .eq("id", row.id);
  }
}
