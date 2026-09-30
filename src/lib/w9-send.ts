import { createHash, randomBytes } from "node:crypto";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { sendBrandedEmail } from "@/lib/email";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { encryptW9Pdf } from "@/lib/w9-crypto";
import { W9_LINK_TTL_DAYS } from "@/lib/w9-fields";
import { W9InputError } from "@/lib/w9-tin";

export type W9SendEvent = {
  id: string;
  client_id: string;
  recipient_email: string;
  sender_user_id: string;
  expires_at: string;
  downloaded_at: string | null;
  revoked_at: string | null;
  created_at: string;
  client_name?: string | null;
};

export function w9TokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newW9Token(): string {
  return randomBytes(32).toString("base64url");
}

export async function listW9Sends(businessId: string, clientId?: string): Promise<W9SendEvent[]> {
  const db = await createTenantServiceClient(businessId);
  let query = db
    .from("w9_sends")
    .select("id, client_id, recipient_email, sender_user_id, expires_at, downloaded_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error("Could not load W-9 history");
  const rows = (data ?? []) as W9SendEvent[];
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  if (!clientIds.length) return rows;
  const { data: clients } = await db.from("clients").select("id, name").in("id", clientIds);
  const names = new Map((clients ?? []).map((client) => [client.id as string, client.name as string]));
  return rows.map((row) => ({ ...row, client_name: names.get(row.client_id) ?? null }));
}

export async function storeAndEmailW9(args: {
  businessId: string;
  clientId: string;
  senderUserId: string;
  pdf: Uint8Array;
}): Promise<{ expiresAt: string; downloadUrl: string; recipientEmail: string }> {
  const db = await createTenantServiceClient(args.businessId);
  const { data: client, error: clientError } = await db
    .from("clients")
    .select("id, name, email")
    .eq("id", args.clientId)
    .maybeSingle();
  if (clientError || !client?.email) {
    throw new W9InputError("That client does not have an email address.");
  }

  const token = newW9Token();
  const expiresAt = new Date(Date.now() + W9_LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: send, error: sendError } = await db
    .from("w9_sends")
    .insert({
      client_id: args.clientId,
      recipient_email: client.email,
      sender_user_id: args.senderUserId,
      token_hash: w9TokenHash(token),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (sendError || !send) throw new Error("Could not record the W-9 send");

  const { error: fileError } = await db.from("w9_send_files").insert({
    send_id: send.id,
    ciphertext: encryptW9Pdf(args.pdf),
  });
  if (fileError) throw new Error("Could not store the W-9");

  const origin = await getBusinessPortalOriginById(args.businessId);
  const downloadUrl = `${origin}/w9/${token}`;
  const when = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  await sendBrandedEmail({
    businessId: args.businessId,
    to: client.email as string,
    subject: "Your Form W-9",
    title: "Form W-9",
    body: [
      `${client.name} — a Form W-9 is ready to download.`,
      `The link works once and expires on ${when}.`,
      "Anyone with this link can download the file. It is not attached to this email.",
    ].join("\n\n"),
    ctaLabel: "Download W-9",
    ctaUrl: downloadUrl,
    emailType: "w9",
    analytics: { emailType: "w9" },
  });

  return { expiresAt, downloadUrl, recipientEmail: client.email as string };
}

export async function revokeW9Send(businessId: string, sendId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("w9_sends")
    .update({ revoked_at: now })
    .eq("id", sendId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Could not revoke the link");
  if (!data) throw new W9InputError("That link is already revoked or was not found.");
  await db.from("w9_send_files").delete().eq("send_id", sendId);
}
