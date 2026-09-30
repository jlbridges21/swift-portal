/**
 * AES-256-GCM for a filled W-9 PDF. Same construction as Google Calendar
 * tokens (random 12-byte IV, 16-byte tag, versioned payload) with a different
 * key purpose so the ciphertexts are not interchangeable.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";

function key(): Buffer {
  const secret =
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("PLATFORM_SESSION_SECRET (or CRON_SECRET) is required to encrypt a W-9.");
  }
  return createHash("sha256").update(`sp-w9-pdf:${secret}`).digest();
}

export function encryptW9Pdf(pdf: Uint8Array): string {
  if (pdf.byteLength < 100) throw new Error("Refusing to encrypt an empty W-9.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(pdf)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptW9Pdf(ciphertext: string): Buffer {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
    throw new Error("Invalid W-9 ciphertext");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
