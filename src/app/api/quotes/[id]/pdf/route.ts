import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { canAccessProject, canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import { safeTimeZone } from "@/lib/estimate-pdf";
import { ensureProposalPdf, proposalPdfFilename } from "@/lib/proposal-delivery";
import type { ProjectQuote } from "@/lib/types";

/** Statuses a client may see a proposal in (drafts and archived rows stay business-only). */
const CLIENT_VISIBLE_STATUSES = new Set(["sent", "approved", "changes_requested"]);

/**
 * The archived PDF of a sent proposal, for the business and the project's
 * assigned clients. When no archive exists yet (sent before archiving worked,
 * or the archive upload failed at send time) it renders from the saved
 * proposal fields once and archives that, so later downloads serve the file.
 * 404 with code "no_snapshot" when the proposal was never sent; the caller
 * then renders its draft preview instead.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isClient = profile.role === "client";
  if (!isClient && !(isOwnerAdmin(profile) || staffCan(profile, "money.view"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (tenant.isSharedViewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Authorize before any service-role read of the row's content or storage.
  const db = await createTenantServiceClient(tenant.businessId);
  const { data: row } = await db.from("project_quotes").select("*").eq("id", id).maybeSingle();
  const quote = row as ProjectQuote | null;
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = isClient
    ? await canAccessProjectAsAssignedClientOrAdmin(profile, quote.project_id)
    : await canAccessProject(profile, quote.project_id);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isClient) {
    if (!CLIENT_VISIBLE_STATUSES.has(quote.status)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: project } = await db.from("projects").select("*").eq("id", quote.project_id).maybeSingle();
    if ((project as { client_section_estimates?: boolean } | null)?.client_section_estimates === false) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (!quote.sent_at || quote.status === "draft") {
    return NextResponse.json({ error: "No stored PDF for this proposal", code: "no_snapshot" }, { status: 404 });
  }

  const url = new URL(request.url);
  let bytes: Uint8Array;
  try {
    const pdf = await ensureProposalPdf({
      businessId: tenant.businessId,
      quote,
      appSettings: await getAppSettings(tenant.businessId),
      timeZone: safeTimeZone(url.searchParams.get("time_zone")),
    });
    bytes = pdf.bytes;
  } catch (error) {
    console.error("[proposal-pdf] download failed", { quoteId: id, error });
    return NextResponse.json({ error: "The proposal PDF couldn't be prepared." }, { status: 500 });
  }

  const download = url.searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${proposalPdfFilename(quote.id)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
