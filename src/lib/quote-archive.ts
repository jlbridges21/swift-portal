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
    .select("id, notes, status")
    .eq("project_id", projectId)
    .eq("quote_kind", "official")
    .neq("id", keepQuoteId);

  const rows = (previous ?? []) as Pick<ProjectQuote, "id" | "notes" | "status">[];
  const ids = rows.map((row) => row.id);
  const paidQuoteIds = new Set<string>();
  if (ids.length) {
    const { data: paid } = await db
      .from("payments")
      .select("quote_id")
      .in("quote_id", ids)
      .eq("status", "paid");
    for (const payment of paid ?? []) {
      if (payment.quote_id) paidQuoteIds.add(payment.quote_id as string);
    }
  }

  for (const row of rows) {
    if (isArchivedQuote(row)) continue;
    if (row.status === "approved" || paidQuoteIds.has(row.id)) continue;

    const notes = row.notes?.trim()
      ? `${ARCHIVED_QUOTE_NOTE}\n\n${row.notes.trim()}`
      : ARCHIVED_QUOTE_NOTE;

    await db
      .from("project_quotes")
      .update({ status: "draft", notes })
      .eq("id", row.id);
  }
}
