import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const AVATAR_BUCKET = "avatars";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 50MB" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `${profile.id}/avatar.${safeExt}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("[avatar] upload failed:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Storage URL not configured" }, { status: 500 });
  }

  const avatarUrl = `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profile.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}
