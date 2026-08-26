import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  PARTNER_LANDING_UPLOAD_MAX_BYTES,
  uploadPartnerLandingAsset,
} from "@/lib/partner-landing";
import { partnerLandingImageTypeError } from "@/lib/partner-landing-image";
import { getPartnerById } from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"];

function parseKind(value: FormDataEntryValue | null): "logo" | "photo" | null {
  if (value === "logo" || value === "photo") return value;
  return null;
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id: partnerId } = await params;

  const partner = await getPartnerById(partnerId);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const kind = parseKind(formData.get("kind"));
  if (!kind) return NextResponse.json({ error: "kind must be logo or photo" }, { status: 400 });

  if (file.size > PARTNER_LANDING_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be under 15MB. Large photos are resized automatically after upload." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const typeOk = ALLOWED_TYPES.has(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) {
    return NextResponse.json({ error: partnerLandingImageTypeError() }, { status: 400 });
  }

  const safeExt = ALLOWED_EXTS.includes(ext) ? ext : "png";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadPartnerLandingAsset({
      partnerId,
      kind,
      buffer,
      contentType: file.type || "application/octet-stream",
      ext: safeExt,
    });
    return NextResponse.json({
      kind,
      url: result.url,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("[platform-partner-landing-upload]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("PNG, JPEG, or WebP") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
