/**
 * AES-256-GCM for a filled W-9 PDF, under its own key purpose so the
 * ciphertexts are not interchangeable with other encrypted secrets.
 */
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";

const PURPOSE = "sp-w9-pdf";
const WHAT = "a W-9";

export function encryptW9Pdf(pdf: Uint8Array): string {
  if (pdf.byteLength < 100) throw new Error("Refusing to encrypt an empty W-9.");
  return sealWithPurpose(PURPOSE, WHAT, Buffer.from(pdf));
}

export function decryptW9Pdf(ciphertext: string): Buffer {
  return openWithPurpose(PURPOSE, WHAT, ciphertext);
}
