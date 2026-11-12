import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { proposalPdfFilename, readStoredProposalPdf } from "@/lib/proposal-delivery";

/**
 * The immutable PDF stored when an official proposal was sent (business only).
 * 404 with code "no_snapshot" when the proposal predates snapshots or was never
 * sent; the caller then renders from the saved proposal fields instead.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "money.view"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const { id } = await params;
  const db = await createTenantServiceClient(tenant.businessId);
  const { data: quote } = await db
    .from("project_quotes")
    .select("id, project_id, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!quote || !(await canAccessProject(profile, quote.project_id as string))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readStoredProposalPdf(db, {
    id: quote.id as string,
    project_id: quote.project_id as string,
    sent_at: (quote.sent_at as string | null) ?? null,
  });
  if (!bytes) {
    return NextResponse.json({ error: "No stored PDF for this proposal", code: "no_snapshot" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${proposalPdfFilename(quote.id as string)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
