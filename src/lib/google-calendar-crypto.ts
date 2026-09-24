/**
 * AES-256-GCM for Google Calendar refresh/access tokens.
 * Same primitive as session handoff, separate key purpose so the two
 * ciphertexts are not interchangeable. Refuses to run without a secret —
 * never falls back to plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";

function key(): Buffer {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error(
      "PLATFORM_SESSION_SECRET (or CRON_SECRET) is required to encrypt Google Calendar tokens."
    );
  }
  return createHash("sha256").update(`sp-gcal-token:${secret}`).digest();
}

export function encryptCalendarSecret(plaintext: string): string {
  if (!plaintext) throw new Error("Refusing to encrypt an empty calendar secret.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCalendarSecret(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
    throw new Error("Invalid calendar token ciphertext");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
