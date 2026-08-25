import { NextResponse } from "next/server";
import {
  PARTNER_LANDING_UPLOAD_MAX_BYTES,
  uploadPartnerLandingAssetForAccess,
} from "@/lib/partner-landing";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"];

function parseKind(value: FormDataEntryValue | null): "logo" | "photo" | null {
  if (value === "logo" || value === "photo") return value;
  return null;
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Ignore attacker-supplied partner_id in the form.
  void formData.get("partner_id");
  void formData.get("partnerId");

  const kind = parseKind(formData.get("kind"));
  if (!kind) return NextResponse.json({ error: "kind must be logo or photo" }, { status: 400 });

  if (file.size > PARTNER_LANDING_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const typeOk = ALLOWED_TYPES.has(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) {
    return NextResponse.json(
      { error: "File must be a PNG, JPEG, or WebP image." },
      { status: 400 }
    );
  }

  const safeExt = ALLOWED_EXTS.includes(ext) ? ext : "png";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadPartnerLandingAssetForAccess(access, {
      kind,
      buffer,
      contentType: file.type || "application/octet-stream",
      ext: safeExt,
    });
    return NextResponse.json({ kind, url });
  } catch (error) {
    console.error("[partner-landing-upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
