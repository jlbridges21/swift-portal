import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { hashHandoffToken } from "@/lib/auth-session-handoff";
import { getShareAccessPortalOrigin, joinPortalPath } from "@/lib/portal-url";
import { normalizeShareEmail } from "@/lib/project-shares";
import { allowShareAccessExchange } from "@/lib/share-access-rate-limit";
import {
  resolveShareAccessWindow,
  validateShareAccessWindow,
  type ShareAccessFields,
} from "@/lib/project-share-expiry";

export {
  formatShareExpiryLabel,
  isShareExpired,
  resolveShareAccessWindow,
  validateShareAccessWindow,
  type ShareAccessFields,
  type ShareAccessMode,
  type ShareAccessValidation,
  type ShareExpiryPreset,
} from "@/lib/project-share-expiry";

export type ShareAccessRow = ShareAccessFields & {
  id: string;
  business_id: string;
  project_id: string;
  email: string;
  access_token_hash: string | null;
  one_time_used_at: string | null;
  revoked_at: string | null;
};

function normalizeShareRequestHost(host: string): string {
  const h = host.toLowerCase().split(":")[0]?.trim() ?? "";
  if (h === "127.0.0.1" || h === "::1" || h === "0:0:0:0:0:0:0:1") return "localhost";
  return h;
}

export function hashShareAccessToken(rawToken: string): string {
  return hashHandoffToken(rawToken);
}

export function generateRawShareAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildShareAccessUrl(portalOrigin: string, rawToken: string): string {
  const url = new URL(joinPortalPath(portalOrigin, "/auth/share"));
  url.searchParams.set("token", rawToken);
  return url.toString();
}

export async function mintShareAccessCredentials(
  shareId: string,
  accessFields: ShareAccessFields
): Promise<{ rawToken: string; hash: string }> {
  const rawToken = generateRawShareAccessToken();
  const hash = hashShareAccessToken(rawToken);

  const raw = await createServiceClient();
  const { error } = await raw
    .from("project_shares")
    .update({
      ...accessFields,
      access_token_hash: hash,
      one_time_used_at: null,
    })
    .eq("id", shareId);

  if (error) throw new Error(error.message);

  return { rawToken, hash };
}

export async function ensureShareAccessToken(
  shareId: string,
  accessFields: ShareAccessFields
): Promise<{ rawToken: string }> {
  const minted = await mintShareAccessCredentials(shareId, accessFields);
  return { rawToken: minted.rawToken };
}

export async function updateShareAccessExpiry(
  shareId: string,
  accessFields: ShareAccessFields
): Promise<void> {
  const raw = await createServiceClient();
  const { error } = await raw
    .from("project_shares")
    .update({
      ...accessFields,
      one_time_used_at: null,
    })
    .eq("id", shareId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}

async function ensureAuthUserForShareEmail(email: string): Promise<{ userId: string | null }> {
  const raw = await createServiceClient();
  const normalized = normalizeShareEmail(email);
  const { data: profiles } = await raw.from("profiles").select("id, email").ilike("email", normalized);
  const match = (profiles ?? []).find(
    (row) => normalizeShareEmail(String(row.email || "")) === normalized
  );
  if (match?.id) return { userId: match.id as string };

  const created = await raw.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { role: "client", full_name: normalized.split("@")[0] },
  });
  if (created.error) {
    if (/already registered|already exists/i.test(created.error.message)) {
      const { data: users } = await raw.auth.admin.listUsers();
      const found = users.users.find((u) => normalizeShareEmail(u.email ?? "") === normalized);
      return { userId: found?.id ?? null };
    }
    throw new Error(created.error.message);
  }
  return { userId: created.data.user?.id ?? null };
}

async function mintSupabaseSessionForEmail(email: string): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
}> {
  const normalized = normalizeShareEmail(email);
  await ensureAuthUserForShareEmail(normalized);
  const raw = await createServiceClient();

  const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(linkError?.message || "Could not mint session");
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message || "Could not verify session");
  }

  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export type ShareAccessErrorCode =
  | "share_invalid"
  | "rate_limited"
  | "share_revoked"
  | "share_not_started"
  | "share_expired"
  | "share_one_time_used";

export type ExchangeShareAccessResult =
  | {
      ok: true;
      userId: string;
      destinationPath: string;
      session: { access_token: string; refresh_token: string };
      shareId: string;
    }
  | { ok: false; code: ShareAccessErrorCode; message: string; email?: string };

export async function exchangeShareAccessToken(args: {
  rawToken: string;
  requestHost: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<ExchangeShareAccessResult> {
  const trimmed = args.rawToken.trim();
  if (!trimmed || trimmed.length < 16) {
    return { ok: false, code: "share_invalid", message: "Invalid share link." };
  }

  const fingerprint = createHash("sha256").update(trimmed).digest("hex").slice(0, 16);
  if (!allowShareAccessExchange(args.ipAddress ?? "unknown", fingerprint)) {
    return { ok: false, code: "rate_limited", message: "Too many attempts. Try again later." };
  }

  const tokenHash = hashShareAccessToken(trimmed);
  const raw = await createServiceClient();

  const { data: share, error } = await raw
    .from("project_shares")
    .select(
      "id, business_id, project_id, email, access_token_hash, access_mode, access_starts_at, access_expires_at, one_time_used_at, revoked_at, expiry_preset"
    )
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error || !share || share.access_token_hash !== tokenHash) {
    return { ok: false, code: "share_invalid", message: "This share link is not valid." };
  }

  const validation = validateShareAccessWindow(share as ShareAccessRow);
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      message: validation.message,
      email: share.email as string,
    };
  }

  const portalOrigin = await getShareAccessPortalOrigin(share.business_id as string);
  const portalHost = normalizeShareRequestHost(new URL(portalOrigin).host);
  const requestHost = normalizeShareRequestHost(args.requestHost);
  const hostOk =
    portalHost === requestHost ||
    (process.env.NODE_ENV !== "production" && requestHost === "localhost");
  if (!hostOk) {
    console.warn("[share-access] host mismatch", { expected: portalHost, got: requestHost });
    return { ok: false, code: "share_invalid", message: "Open this link on the studio portal it was sent from." };
  }

  let session;
  try {
    session = await mintSupabaseSessionForEmail(share.email as string);
  } catch (err) {
    console.error("[share-access] session mint failed", err);
    return { ok: false, code: "share_invalid", message: "Could not sign you in. Request a new link below." };
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    last_accessed_at: nowIso,
  };
  if (share.access_mode === "one_time") {
    updates.one_time_used_at = nowIso;
  }

  const { error: updateError } = await raw
    .from("project_shares")
    .update(updates)
    .eq("id", share.id)
    .is("revoked_at", null);

  if (updateError) {
    console.error("[share-access] post-exchange update failed", updateError.message);
    return { ok: false, code: "share_invalid", message: "Could not complete sign-in." };
  }

  void raw.from("project_share_exchange_log").insert({
    share_id: share.id,
    ip_address: args.ipAddress,
    user_agent: args.userAgent,
  });

  console.info("[share-access] exchange ok", {
    shareId: share.id,
    projectId: share.project_id,
    email: share.email,
    ip: args.ipAddress,
  });

  return {
    ok: true,
    userId: session.userId,
    shareId: share.id as string,
    destinationPath: `/dashboard/projects/${share.project_id as string}`,
    session: {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    },
  };
}

export async function buildShareAccessLinkForShare(options: {
  shareId: string;
  businessId: string;
  accessFields?: ShareAccessFields;
  rotateToken?: boolean;
}): Promise<string> {
  const portalOrigin = await getShareAccessPortalOrigin(options.businessId);
  const { rawToken } = await mintShareAccessCredentials(
    options.shareId,
    options.accessFields ?? resolveShareAccessWindow("30days")
  );
  return buildShareAccessUrl(portalOrigin, rawToken);
}
