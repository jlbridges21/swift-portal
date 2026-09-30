/**
 * TIN handling. The value lives only in the local variable that fills the PDF.
 * Errors use fixed sentences and never interpolate the typed value.
 */
import { TIN_STORAGE_KEYS } from "@/lib/w9-fields";

export class W9InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "W9InputError";
  }
}

export type TinKind = "ssn" | "ein";

export type ParsedTin = { kind: TinKind; digits: string };

const TIN_SHAPED =
  /\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b|\b\d{9}\b/g;

/** Use on every log line and error string before it leaves the process. */
export function redactPossibleTin(text: string): string {
  return text.replace(TIN_SHAPED, "[redacted]");
}

export function looksLikeStoredTin(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d{3}-\d{2}-\d{4}$/.test(trimmed) || /^\d{2}-\d{7}$/.test(trimmed)) return true;
  const compact = trimmed.replace(/[-\s]/g, "");
  return /^\d{9}$/.test(compact) && compact.length === trimmed.replace(/\s/g, "").replace(/-/g, "").length;
}

/**
 * Read the TIN off a request object and delete it from that object so a later
 * serializer cannot pick it up. The returned digits are the only copy.
 */
export function takeTin(input: Record<string, unknown>): ParsedTin {
  const kind = input.tinKind;
  const raw = input.tin;
  for (const key of TIN_STORAGE_KEYS) delete input[key];
  delete input.tinKind;

  if (kind !== "ssn" && kind !== "ein") {
    throw new W9InputError("Choose SSN or EIN.");
  }
  if (typeof raw !== "string") {
    throw new W9InputError("Enter a 9-digit taxpayer identification number.");
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) {
    throw new W9InputError("Enter a 9-digit taxpayer identification number.");
  }
  return { kind, digits };
}

/**
 * Preview must not accept a taxpayer identification number under any key,
 * or a TIN-shaped string in any field. The message is fixed and does not
 * include the submitted value.
 */
export function assertNoTinInPreview(value: unknown): void {
  if (typeof value === "string") {
    if (looksLikeStoredTin(value)) {
      throw new W9InputError("A taxpayer identification number is not part of the preview.");
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoTinInPreview(item);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "tinKind" || (TIN_STORAGE_KEYS as readonly string[]).includes(key)) {
      throw new W9InputError("A taxpayer identification number is not part of the preview.");
    }
    assertNoTinInPreview(child);
  }
}

export function logW9Failure(err: unknown): void {
  const message = err instanceof Error ? err.message : "W-9 request failed";
  console.error("[w9]", redactPossibleTin(message));
}
