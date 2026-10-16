/**
 * AES-256-GCM keyed per purpose: random 12-byte IV, 16-byte tag, payload
 * "v1.iv.tag.data" (base64url). Each purpose derives its own key from the
 * platform secret, so ciphertexts are not interchangeable between features.
 * Refuses to run without a secret — never falls back to plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";

function key(purpose: string, what: string): Buffer {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error(`PLATFORM_SESSION_SECRET (or CRON_SECRET) is required to encrypt ${what}.`);
  }
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

export function sealWithPurpose(purpose: string, what: string, data: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose, what), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function openWithPurpose(purpose: string, what: string, ciphertext: string): Buffer {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
    throw new Error(`Invalid ${what} ciphertext`);
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(purpose, what), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
