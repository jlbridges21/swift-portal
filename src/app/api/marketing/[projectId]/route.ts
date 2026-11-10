import { NextResponse } from "next/server";
import { marketingErrorResponse, requireMarketingRoute } from "@/lib/marketing/route-auth";
import {
  MarketingError,
  publishWebsite,
  saveBrandProfileFromContent,
  saveDraft,
  saveOfferOverride,
  saveSiteSlug,
  toClientState,
  unpublishWebsite,
} from "@/lib/marketing/server";
import { compProduct, createAddonPayment } from "@/lib/marketing/purchases";

export const dynamic = "force-dynamic";

/** Current Marketing Kit state for the editor. */
export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ state: toClientState(auth.ctx, auth.actor) });
}

/** Save the draft (overrides only). Never touches the published website. */
export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  const { ctx, actor } = auth;
  if (actor.kind === "business" ? !actor.canEdit : !ctx.settings.clientCanEdit) {
    return NextResponse.json({ error: "You can preview this Marketing Kit, but editing is turned off." }, { status: 403 });
  }
  let body: { overrides?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    await saveDraft(ctx, body.overrides ?? {}, actor);
    return NextResponse.json({ state: toClientState(ctx, actor) });
  } catch (e) {
    return marketingErrorResponse(e);
  }
}

/**
 * Actions:
 *  publish | unpublish                     — website (business, or client with access + permission)
 *  set_slug {slug}                         — business only
 *  set_offer {product, offer}              — business with money permission
 *  include {product}                       — business: grant at no charge
 *  bill {products}                         — business: add the add-on to the client's invoice
 *  save_brand_profile                      — save agent + branding as this realtor's defaults
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  const { ctx, actor } = auth;
  let body: { action?: string; slug?: unknown; product?: unknown; offer?: unknown; products?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const isBiz = actor.kind === "business";
  const product = body.product === "website" || body.product === "social" ? body.product : null;

  try {
    switch (body.action) {
      case "publish": {
        if (isBiz ? !actor.canEdit : !ctx.settings.clientCanPublish) throw new MarketingError("Publishing is turned off for clients on this project.", 403);
        await publishWebsite(ctx, actor);
        break;
      }
      case "unpublish": {
        if (isBiz ? !actor.canEdit : !(ctx.settings.clientCanPublish && ctx.access.website.hasAccess)) {
          throw new MarketingError("You can't unpublish this website.", 403);
        }
        await unpublishWebsite(ctx, actor);
        break;
      }
      case "set_slug": {
        if (!isBiz || !actor.canEdit) throw new MarketingError("Only the business can change the web address.", 403);
        await saveSiteSlug(ctx, body.slug);
        break;
      }
      case "set_offer": {
        if (!isBiz || !actor.canManageOffers) throw new MarketingError("You don't have permission to change pricing.", 403);
        if (!product) throw new MarketingError("Choose a product.");
        await saveOfferOverride(ctx, product, body.offer ?? null);
        break;
      }
      case "include": {
        if (!isBiz || !actor.canManageOffers) throw new MarketingError("You don't have permission to include add-ons.", 403);
        if (!product) throw new MarketingError("Choose a product.");
        await compProduct(ctx, actor, product);
        break;
      }
      case "bill": {
        if (!isBiz) throw new MarketingError("Use Purchase to buy an add-on.", 403);
        await createAddonPayment(ctx, actor, body.products, "add_to_invoice");
        break;
      }
      case "save_brand_profile": {
        if (isBiz ? !actor.canEdit : !ctx.settings.clientCanEdit) throw new MarketingError("You can't save branding here.", 403);
        await saveBrandProfileFromContent(ctx, actor);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    // Reload so access/offers/purchases reflect the change.
    const fresh = await requireMarketingRoute(projectId);
    if (!fresh.ok) return fresh.response;
    return NextResponse.json({ state: toClientState(fresh.ctx, fresh.actor) });
  } catch (e) {
    return marketingErrorResponse(e);
  }
}
