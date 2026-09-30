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
