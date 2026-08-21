import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";
import { EntitlementError, requireEntitlement } from "@/lib/entitlements";

const LOGO_BUCKET = "business-logos";
/** Stay under Vercel’s 4.5MB serverless body cap so the route actually runs. */
const MAX_BYTES = 4 * 1024 * 1024;

export const BRAND_ASSET_KINDS = ["logo", "emailLogo", "favicon"] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];

const KIND_CONFIG: Record<
  BrandAssetKind,
  { pathBase: string; field: "logoUrl" | "emailLogoUrl" | "faviconUrl"; types: Set<string>; exts: string[] }
> = {
  logo: {
    pathBase: "logo",
    field: "logoUrl",
    types: new Set(["image/png", "image/jpeg", "image/webp"]),
    exts: ["jpg", "jpeg", "png", "webp"],
  },
  emailLogo: {
    pathBase: "email-logo",
    field: "emailLogoUrl",
    types: new Set(["image/png", "image/jpeg", "image/webp"]),
    exts: ["jpg", "jpeg", "png", "webp"],
  },
  favicon: {
    pathBase: "favicon",
    field: "faviconUrl",
    types: new Set([
      "image/png",
      "image/x-icon",
      "image/vnd.microsoft.icon",
      "image/svg+xml",
      "image/webp",
    ]),
    exts: ["png", "ico", "svg", "webp"],
  },
};

function parseKind(value: FormDataEntryValue | null): BrandAssetKind {
  if (value === "emailLogo" || value === "favicon" || value === "logo") return value;
  return "logo";
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  try {
    await requireEntitlement(tenant.businessId, "custom_branding");
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const kind = parseKind(formData.get("kind"));
  const config = KIND_CONFIG[kind];

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "favicon" ? "png" : "png");
  const typeOk = config.types.has(file.type) || (kind === "favicon" && config.exts.includes(ext));
  if (!typeOk) {
    const message =
      kind === "favicon"
        ? "Favicon must be a PNG, ICO, or SVG file."
        : "File must be a PNG, JPEG, or WebP image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const safeExt = config.exts.includes(ext) ? ext : kind === "favicon" ? "png" : "png";
  const path = `${tenant.businessId}/${config.pathBase}.${safeExt}`;

  const db = await createTenantServiceClient(tenant.businessId);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await db.raw.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    console.error("[business-logo] upload failed:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Storage URL not configured" }, { status: 500 });
  }

  const assetUrl = `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${path}?v=${Date.now()}`;
  const current = await getAppSettings(tenant.businessId);
  const businessPatch = { ...current.business, [config.field]: assetUrl };
  // Prefer the real upload over a relative platform placeholder for email.
  const emailLogo = (current.business.emailLogoUrl || "").trim();
  if (
    kind === "logo" &&
    (!emailLogo || emailLogo.startsWith("/") || emailLogo === current.business.logoUrl)
  ) {
    businessPatch.emailLogoUrl = assetUrl;
  }

  const saved = await saveAppSettings({ business: businessPatch }, profile.id, tenant.businessId);

  return NextResponse.json({
    kind,
    url: assetUrl,
    logoUrl: kind === "logo" ? assetUrl : saved.business.logoUrl,
    settings: saved,
  });
}
