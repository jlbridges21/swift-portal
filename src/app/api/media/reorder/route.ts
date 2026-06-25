import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid items" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    for (const item of body.items) {
      const table = item.type === "tour" ? "tours" : "media_assets";
      await supabase
        .from(table)
        .update({ display_order: item.display_order })
        .eq("id", item.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
