import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { marketingErrorResponse, requireMarketingRoute } from "@/lib/marketing/route-auth";
import { MARKETING_BUCKET } from "@/lib/marketing/server";
import { marketingUploadPrefix } from "@/lib/marketing/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload a brokerage logo or agent headshot for this project's Marketing Kit.
 * Re-encoded server-side (strips metadata, bounds size) and stored privately under
 * {business}/marketing/{project}/ in the project media bucket.
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  const { ctx, actor } = auth;
  if (actor.kind === "business" ? !actor.canEdit : !ctx.settings.clientCanEdit) {
    return NextResponse.json({ error: "Editing is turned off." }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind") === "headshot" ? "headshot" : "logo";
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 400 });

    const input = Buffer.from(await file.arrayBuffer());
    const pipeline = sharp(input, { failOn: "error" }).rotate();
    const out =
      kind === "headshot"
        ? await pipeline.resize(800, 800, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toBuffer()
        : await pipeline.resize(1200, 600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const ext = kind === "headshot" ? "jpg" : "png";
    const path = `${marketingUploadPrefix(ctx.businessId, projectId)}${kind}-${randomUUID()}.${ext}`;
    const { error } = await ctx.db.raw.storage.from(MARKETING_BUCKET).upload(path, out, {
      contentType: kind === "headshot" ? "image/jpeg" : "image/png",
      upsert: false,
    });
    if (error) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    return NextResponse.json({ ref: { kind: "upload", path } });
  } catch (e) {
    if (e instanceof Error && /Input buffer|unsupported image/i.test(e.message)) {
      return NextResponse.json({ error: "That file isn't a readable image." }, { status: 400 });
    }
    return marketingErrorResponse(e);
  }
}
