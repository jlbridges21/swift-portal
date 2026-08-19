import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentOrigin } from "@/lib/portal-url";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const origin = request.headers.get("origin") || getDeploymentOrigin();
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}
