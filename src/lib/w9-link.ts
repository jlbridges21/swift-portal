import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { decryptW9Pdf } from "@/lib/w9-crypto";
import { w9TokenHash } from "@/lib/w9-send";

export const W9_DOWNLOAD_HEADERS = {
  "Content-Type": "application/pdf",
  "Content-Disposition": 'attachment; filename="w-9.pdf"',
  "Cache-Control": "private, no-store, no-cache, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Pragma: "no-cache",
} as const;

type SendLookup = {
  id: string;
  business_id: string;
  expires_at: string;
  revoked_at: string | null;
  downloaded_at: string | null;
};

/**
 * Token lookup is unscoped on purpose: the unguessable token is the capability,
 * the same way /view/{token} resolves a project. The hash is stored, not the token.
 */
export async function lookupW9SendByToken(token: string): Promise<SendLookup | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("w9_sends")
    .select("id, business_id, expires_at, revoked_at, downloaded_at")
    .eq("token_hash", w9TokenHash(token))
    .maybeSingle();
  if (error || !data) return null;
  return data as SendLookup;
}

export async function claimW9Download(token: string): Promise<
  | { ok: true; pdf: Buffer }
  | { ok: false; status: 404 | 410 }
> {
  const profile = await getProfile();
  if (profile?.role === "staff") return { ok: false, status: 404 };

  const send = await lookupW9SendByToken(token);
  if (!send) return { ok: false, status: 404 };
  if (send.revoked_at || send.downloaded_at) return { ok: false, status: 410 };
  if (new Date(send.expires_at).getTime() <= Date.now()) return { ok: false, status: 410 };

  const db = await createTenantServiceClient(send.business_id);
  const { data: file, error } = await db
    .from("w9_send_files")
    .delete()
    .eq("send_id", send.id)
    .select("ciphertext")
    .maybeSingle();
  if (error || !file?.ciphertext) return { ok: false, status: 410 };

  await db.from("w9_sends").update({ downloaded_at: new Date().toISOString() }).eq("id", send.id);
  return { ok: true, pdf: decryptW9Pdf(file.ciphertext as string) };
}
