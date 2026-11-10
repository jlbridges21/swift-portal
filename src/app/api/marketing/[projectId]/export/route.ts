import { NextResponse } from "next/server";
import { marketingErrorResponse, requireMarketingRoute } from "@/lib/marketing/route-auth";
import { buildListingView, type UrlResolver } from "@/lib/marketing/view-model";
import { buildSocialItems, socialFileBase, type SocialItem } from "@/lib/marketing/social-inputs";
import { signMediaImage, signUpload } from "@/lib/marketing/media";
import { renderItem, renderZip } from "@/lib/marketing/render";
import type { AssetRef } from "@/lib/marketing/model";
import type { KitContext } from "@/lib/marketing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const EXPORT_PHOTO_WIDTH = 2400;

/** Build export items twice: first with tokens to learn which images are needed, then signed. */
async function exportItems(ctx: KitContext): Promise<SocialItem[]> {
  const tokenUrls: UrlResolver = {
    image: (ref: AssetRef) =>
      ref.kind === "media" ? `media:${ref.id}` : ref.kind === "upload" ? `upload:${ref.path}` : ctx.businessLogoUrl,
    video: () => null,
    poster: () => null,
  };
  const build = (urls: UrlResolver, photoUrl: (id: string | null) => string | null) =>
    buildSocialItems({
      content: ctx.content,
      media: ctx.media,
      coverId: ctx.project.cover_image_id,
      view: buildListingView({ content: ctx.content, media: ctx.media, tours: [], coverId: ctx.project.cover_image_id, businessName: ctx.businessName, urls }),
      photoUrl,
    });
  const draft = build(tokenUrls, (id) => (id ? `media:${id}` : null));
  const tokens = new Set<string>();
  for (const it of draft) {
    const i = it.input;
    [i.photo, ...i.supporting, i.slide?.photo, i.view.agent.headshotUrl, i.view.agent.brokerageLogoUrl, i.view.branding.logoUrl].forEach((t) => {
      if (t && (t.startsWith("media:") || t.startsWith("upload:"))) tokens.add(t);
    });
  }
  const rows = new Map(ctx.mediaRows.map((r) => [r.id, r]));
  const signed = new Map<string, string | null>();
  await Promise.all(
    Array.from(tokens).map(async (t) => {
      if (t.startsWith("media:")) {
        const row = rows.get(t.slice(6));
        signed.set(t, row ? await signMediaImage(ctx.db, row, "large", EXPORT_PHOTO_WIDTH) : null);
      } else {
        signed.set(t, await signUpload(ctx.db, t.slice(7), "export"));
      }
    })
  );
  const real: UrlResolver = {
    image: (ref: AssetRef) =>
      ref.kind === "media" ? signed.get(`media:${ref.id}`) ?? null : ref.kind === "upload" ? signed.get(`upload:${ref.path}`) ?? null : ctx.businessLogoUrl,
    video: () => null,
    poster: () => null,
  };
  return build(real, (id) => (id ? signed.get(`media:${id}`) ?? null : null));
}

function attachment(body: Buffer, contentType: string, fileName: string) {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * GET ?item=sq_just_listed | st_open_house | carousel-2 | flyer   → one file
 * GET ?item=all[&ids=a,b,c]                                       → ZIP (selected, or every enabled asset)
 * Paid kits: only the business, or a client who purchased / was included, may export.
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  const { ctx, actor } = auth;
  if (actor.kind === "client" && !ctx.access.social.hasAccess) {
    return NextResponse.json({ error: "Purchase the Social Media Kit to download full-resolution files." }, { status: 402 });
  }
  if (!ctx.media.some((m) => m.type === "photo")) {
    return NextResponse.json({ error: "Add approved photos to the project first." }, { status: 400 });
  }
  const url = new URL(request.url);
  const which = url.searchParams.get("item") ?? "all";
  const title = `${ctx.content.property.address || "Listing"} — Marketing Kit`;
  try {
    const items = await exportItems(ctx);
    if (which === "all") {
      const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
      const chosen = ids.length ? items.filter((i) => ids.includes(i.id)) : items;
      if (!chosen.length) return NextResponse.json({ error: "Choose at least one asset." }, { status: 400 });
      const zip = await renderZip(chosen, title);
      return attachment(zip, "application/zip", `${socialFileBase(ctx.content.property.address)}-marketing-kit.zip`);
    }
    const item = items.find((i) => i.id === which);
    if (!item) return NextResponse.json({ error: "That asset isn't available. Check its details in the editor." }, { status: 404 });
    const { body, contentType } = await renderItem(item, title);
    return attachment(body, contentType, item.fileName);
  } catch (e) {
    return marketingErrorResponse(e);
  }
}
