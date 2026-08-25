import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const HANDOFF_TTL_MS = 60_000;
const CIPHER_VERSION = "v1";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export type HandoffSessionPayload = {
  access_token: string;
  refresh_token: string;
};

function handoffSecret(): Buffer {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("PLATFORM_SESSION_SECRET (or CRON_SECRET) is required for session handoff.");
  }
  // Derive a 32-byte key from the signing secret.
  return createHash("sha256").update(`sp-handoff:${secret}`).digest();
}

export function hashHandoffToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function encryptSession(payload: HandoffSessionPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", handoffSecret(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSession(ciphertext: string): HandoffSessionPayload {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
    throw new Error("Invalid handoff ciphertext");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", handoffSecret(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plain) as HandoffSessionPayload;
  if (
    typeof parsed.access_token !== "string" ||
    typeof parsed.refresh_token !== "string" ||
    !parsed.access_token ||
    !parsed.refresh_token
  ) {
    throw new Error("Invalid handoff session payload");
  }
  return parsed;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0]?.trim() ?? "";
}

function safePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

/**
 * Same-origin: return destination unchanged (no token minted).
 * Cross-origin: mint a single-use handoff URL on the destination host.
 */
export async function maybeMintSessionHandoff(args: {
  currentOrigin: string;
  destinationUrl: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}): Promise<string> {
  let dest: URL;
  let current: URL;
  try {
    dest = new URL(args.destinationUrl);
    current = new URL(args.currentOrigin);
  } catch {
    return args.destinationUrl;
  }

  if (normalizeHost(dest.host) === normalizeHost(current.host)) {
    return args.destinationUrl;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashHandoffToken(rawToken);
  const destinationHost = normalizeHost(dest.host);
  const destinationPath = safePath(`${dest.pathname}${dest.search}` || "/");
  const sessionCiphertext = encryptSession({
    access_token: args.accessToken,
    refresh_token: args.refreshToken,
  });
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

  const service = serviceClient();
  const { error } = await service.from("auth_session_handoffs").insert({
    token_hash: tokenHash,
    user_id: args.userId,
    destination_host: destinationHost,
    destination_path: destinationPath,
    session_ciphertext: sessionCiphertext,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[auth-handoff] mint failed", error.message);
    throw new Error("Could not create session handoff");
  }

  const handoff = new URL("/auth/handoff", dest.origin);
  handoff.searchParams.set("token", rawToken);
  return handoff.toString();
}

export type ConsumeHandoffResult =
  | {
      ok: true;
      userId: string;
      destinationPath: string;
      session: HandoffSessionPayload;
    }
  | { ok: false; error: string };

/**
 * Atomically consume a handoff token bound to destination_host.
 * Must only be called after verifying the request host matches destination_host.
 */
export async function consumeSessionHandoff(args: {
  rawToken: string;
  requestHost: string;
}): Promise<ConsumeHandoffResult> {
  const raw = args.rawToken.trim();
  if (!raw || raw.length < 16) {
    return { ok: false, error: "Invalid handoff token" };
  }

  const requestHost = normalizeHost(args.requestHost);
  if (!requestHost) {
    return { ok: false, error: "Missing host" };
  }

  const tokenHash = hashHandoffToken(raw);
  const service = serviceClient();
  const nowIso = new Date().toISOString();

  const { data: row, error: lookupError } = await service
    .from("auth_session_handoffs")
    .select("id, user_id, destination_host, destination_path, session_ciphertext, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (lookupError || !row) {
    return { ok: false, error: "Handoff not found or already used" };
  }
  if (row.consumed_at) {
    return { ok: false, error: "Handoff already used" };
  }
  if (row.expires_at <= nowIso) {
    return { ok: false, error: "Handoff expired" };
  }
  if (normalizeHost(row.destination_host) !== requestHost) {
    console.warn("[auth-handoff] destination_host mismatch", {
      expected: row.destination_host,
      got: requestHost,
    });
    return { ok: false, error: "Handoff host mismatch" };
  }

  const { data: consumed, error: consumeError } = await service
    .from("auth_session_handoffs")
    .update({ consumed_at: nowIso })
    .eq("id", row.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    return { ok: false, error: "Handoff already used" };
  }

  try {
    const session = decryptSession(row.session_ciphertext);
    return {
      ok: true,
      userId: row.user_id,
      destinationPath: safePath(row.destination_path || "/"),
      session,
    };
  } catch (err) {
    console.error("[auth-handoff] decrypt failed", err);
    return { ok: false, error: "Invalid handoff payload" };
  }
}

/**
 * Given an absolute post-login destination and the current request origin + session,
 * return the URL the browser should navigate to (handoff interstitial or same-origin dest).
 */
export async function resolveCrossOriginRedirect(args: {
  currentOrigin: string;
  redirect: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}): Promise<string> {
  const absolute =
    args.redirect.startsWith("http://") || args.redirect.startsWith("https://")
      ? args.redirect
      : new URL(
          args.redirect.startsWith("/") ? args.redirect : `/${args.redirect}`,
          args.currentOrigin
        ).toString();

  return maybeMintSessionHandoff({
    currentOrigin: args.currentOrigin,
    destinationUrl: absolute,
    userId: args.userId,
    accessToken: args.accessToken,
    refreshToken: args.refreshToken,
  });
}
