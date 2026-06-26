import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, company")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        company: body.company || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.password) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.name, role: "client" },
      });

      if (authError) {
        console.error("Auth user creation failed:", authError.message);
        return NextResponse.json(
          { error: `Client created but portal login failed: ${authError.message}` },
          { status: 207 }
        );
      }

      if (authUser.user) {
        await supabase
          .from("clients")
          .update({ user_id: authUser.user.id })
          .eq("id", client.id);

        await supabase
          .from("profiles")
          .update({
            client_id: client.id,
            role: "client",
            email_notifications_enabled: true,
            in_app_notifications_enabled: true,
          })
          .eq("id", authUser.user.id);
      }
    }

    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    const allowed = ["name", "email", "phone", "company", "notes", "full_name", "referral_source"];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) sanitized[key] = updates[key];
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("clients")
      .update(sanitized)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
