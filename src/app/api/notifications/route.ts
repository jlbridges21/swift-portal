import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json([]);
    }

    const supabase = await createClient();
    let query = supabase
      .from("notifications")
      .select("id, type, title, body, link, project_id, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (profile.business_id) {
      query = query.eq("business_id", profile.business_id);
    }
    const { data, error } = await query;

    if (error) {
      console.error("[notifications] GET failed", {
        userId: profile.id,
        code: error.code,
        message: error.message,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: "Failed to load notifications." },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications] GET unhandled", { message });
    return NextResponse.json({ error: "Failed to load notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (body.markAll) {
      let markAll = supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", profile.id)
        .is("read_at", null);
      if (profile.business_id) {
        markAll = markAll.eq("business_id", profile.business_id);
      }
      const { error } = await markAll;

      if (error) {
        console.error("[notifications] PATCH markAll failed", {
          userId: profile.id,
          message: error.message,
        });
        return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    let markOne = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("user_id", profile.id);
    if (profile.business_id) {
      markOne = markOne.eq("business_id", profile.business_id);
    }
    const { error } = await markOne;

    if (error) {
      console.error("[notifications] PATCH failed", {
        userId: profile.id,
        notificationId: body.id,
        message: error.message,
      });
      return NextResponse.json({ error: "Failed to update notification." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications] PATCH unhandled", { message });
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
  }
}
