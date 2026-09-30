import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/app-settings";
import { fillW9Pdf, type W9Signature } from "@/lib/w9-pdf";
import { loadActiveW9Template } from "@/lib/w9-template";
import { W9InputError, logW9Failure, takeTin } from "@/lib/w9-tin";
import type { TaxInformationSettings } from "@/lib/w9-fields";

export function w9ErrorResponse(err: unknown): NextResponse {
  logW9Failure(err);
  if (err instanceof W9InputError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Could not generate the form." }, { status: 500 });
}

export function readSignature(input: Record<string, unknown>, date: string): W9Signature {
  const mode = input.signatureMode;
  if (mode === "blank") return { mode: "blank" };
  if (mode !== "typed") throw new W9InputError("Choose a typed signature or a blank signature line.");
  if (input.attestation !== true) {
    throw new W9InputError("Confirm the Part II certification before adding a typed signature.");
  }
  const name = typeof input.typedName === "string" ? input.typedName.trim() : "";
  if (!name || name.length > 80) {
    throw new W9InputError("Enter the name to place on the signature line.");
  }
  return { mode: "typed", name, date };
}

export function w9SignatureDate(timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export function isTaxInformationReady(tax: TaxInformationSettings): boolean {
  try {
    assertTaxReady(tax);
    return true;
  } catch {
    return false;
  }
}

export function assertTaxReady(tax: TaxInformationSettings): void {
  if (!tax.name.trim()) throw new W9InputError("Enter the name on line 1 before generating a W-9.");
  if (!tax.federalTaxClassification) {
    throw new W9InputError("Choose a federal tax classification before generating a W-9.");
  }
  if (!tax.address.trim() || !tax.cityStateZip.trim()) {
    throw new W9InputError("Enter the address and city, state, and ZIP before generating a W-9.");
  }
}

export async function createW9Pdf(args: {
  businessId: string;
  body: Record<string, unknown>;
  date: string;
}): Promise<Uint8Array> {
  const tin = takeTin(args.body);
  const signature = readSignature(args.body, args.date);
  const settings = await getAppSettings(args.businessId);
  assertTaxReady(settings.tax);
  const template = await loadActiveW9Template();
  return fillW9Pdf({
    templateBytes: template,
    tax: settings.tax,
    tin,
    signature,
  });
}

/**
 * Same fill as a real W-9, with the identification boxes left empty.
 * Callers must already have refused any taxpayer identification number.
 */
export async function createW9PreviewPdf(args: {
  businessId: string;
  tax: TaxInformationSettings;
  signature: W9Signature;
}): Promise<Uint8Array> {
  const template = await loadActiveW9Template();
  return fillW9Pdf({
    templateBytes: template,
    tax: args.tax,
    tin: null,
    signature: args.signature,
  });
}

/** Preview may show a typed name before the Part II checkbox. It never reads a TIN. */
export function readPreviewSignature(input: Record<string, unknown>, date: string): W9Signature {
  const mode = input.signatureMode;
  if (mode == null || mode === "blank") return { mode: "blank" };
  if (mode !== "typed") throw new W9InputError("Choose a typed signature or a blank signature line.");
  const name = typeof input.typedName === "string" ? input.typedName.trim() : "";
  if (name.length > 80) throw new W9InputError("Enter the name to place on the signature line.");
  return { mode: "typed", name, date };
}
