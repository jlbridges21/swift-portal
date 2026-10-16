/**
 * AES-256-GCM for Google Calendar refresh/access tokens, under its own key
 * purpose so the ciphertexts are not interchangeable with other secrets.
 */
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";

const PURPOSE = "sp-gcal-token";
const WHAT = "Google Calendar tokens";

export function encryptCalendarSecret(plaintext: string): string {
  if (!plaintext) throw new Error("Refusing to encrypt an empty calendar secret.");
  return sealWithPurpose(PURPOSE, WHAT, Buffer.from(plaintext, "utf8"));
}

export function decryptCalendarSecret(ciphertext: string): string {
  return openWithPurpose(PURPOSE, WHAT, ciphertext).toString("utf8");
}
