import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Hard-delete W-9 ciphertext after the link expires, and any file left behind
 * a revoke or download. The send event row stays so history remains.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const supabase = await createServiceClient();
  const now = new Date().toISOString();
  const [expired, revoked, downloaded] = await Promise.all([
    supabase.from("w9_sends").select("id").lt("expires_at", now),
    supabase.from("w9_sends").select("id").not("revoked_at", "is", null),
    supabase.from("w9_sends").select("id").not("downloaded_at", "is", null),
  ]);
  if (expired.error || revoked.error || downloaded.error) {
    console.error("[cron/w9-purge] list failed");
    return NextResponse.json({ error: "W-9 purge failed" }, { status: 500 });
  }
  const ids = [
    ...new Set(
      [...(expired.data ?? []), ...(revoked.data ?? []), ...(downloaded.data ?? [])].map(
        (row) => row.id as string
      )
    ),
  ];
  if (!ids.length) return NextResponse.json({ ok: true, deleted: 0 });

  const { data: removed, error: deleteError } = await supabase
    .from("w9_send_files")
    .delete()
    .in("send_id", ids)
    .select("send_id");
  if (deleteError) {
    console.error("[cron/w9-purge] delete failed");
    return NextResponse.json({ error: "W-9 purge failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: removed?.length ?? 0 });
}
