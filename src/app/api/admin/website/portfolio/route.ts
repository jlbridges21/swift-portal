import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  loadPortfolioCandidates,
  loadSitePortfolio,
  publishPortfolioEntry,
  PortfolioError,
  updatePortfolioFlags,
} from "@/lib/website/portfolio-server";

export const dynamic = "force-dynamic";

async function auth() {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) } as const;
  return { profile, tenant } as const;
}

async function state(businessId: string) {
  const [candidates, projects] = await Promise.all([loadPortfolioCandidates(businessId), loadSitePortfolio(businessId, "admin")]);
  return { candidates, projects };
}

/** Settings → Business Website → Portfolio: published projects, suggestions, preview data. */
export async function GET() {
  const a = await auth();
  if ("error" in a) return a.error;
  return NextResponse.json(await state(a.tenant.businessId));
}

/**
 * Explicit business actions only. Nothing becomes public without "publish":
 *   publish   { projectId, title, category?, description?, mediaIds, coverId?, tourIds?, featured? }
 *   remove | feature | unfeature | dismiss | restore   { projectId }
 */
export async function POST(request: Request) {
  const a = await auth();
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const action = body.action;
    if (action === "publish") {
      await publishPortfolioEntry(a.tenant.businessId, a.profile.id, {
        projectId: body.projectId,
        title: body.title,
        category: body.category,
        description: body.description,
        mediaIds: body.mediaIds,
        coverId: body.coverId,
        tourIds: body.tourIds,
        featured: body.featured,
      });
    } else if (action === "remove" || action === "feature" || action === "unfeature" || action === "dismiss" || action === "restore") {
      await updatePortfolioFlags(a.tenant.businessId, a.profile.id, { action, projectId: body.projectId });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json(await state(a.tenant.businessId));
  } catch (e) {
    if (e instanceof PortfolioError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed" }, { status: 500 });
  }
}
