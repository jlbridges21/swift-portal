import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as fontkitNs from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  W9_FIELDS,
  classificationCheckbox,
  type TaxInformationSettings,
} from "@/lib/w9-fields";
import { W9InputError, type ParsedTin } from "@/lib/w9-tin";

export type W9Signature =
  | { mode: "typed"; name: string; date: string }
  | { mode: "blank" };

/**
 * Fill the official IRS AcroForm. The signature line on Rev. March 2024 is not
 * an AcroForm field, so a typed name is drawn on that line. A blank signature
 * leaves the line empty.
 *
 * `tin` is used only for the SSN or EIN boxes and is not copied into errors.
 */
export async function fillW9Pdf(args: {
  templateBytes: Uint8Array;
  tax: TaxInformationSettings;
  /** Null leaves the SSN and EIN boxes empty. Preview always passes null. */
  tin: ParsedTin | null;
  signature: W9Signature;
}): Promise<Uint8Array> {
  if (process.env.W9_FORCE_GENERATE_FAIL === "1") {
    throw new Error("W-9 generation failed");
  }

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(args.templateBytes);
  } catch {
    throw new Error("W-9 template could not be read");
  }

  const form = pdf.getForm();
  const boxes = [
    W9_FIELDS.individual,
    W9_FIELDS.cCorp,
    W9_FIELDS.sCorp,
    W9_FIELDS.partnership,
    W9_FIELDS.trustEstate,
    W9_FIELDS.llc,
    W9_FIELDS.other,
    W9_FIELDS.foreignPartners,
  ];
  for (const name of boxes) form.getCheckBox(name).uncheck();

  form.getTextField(W9_FIELDS.name).setText(args.tax.name);
  form.getTextField(W9_FIELDS.disregardedEntityName).setText(args.tax.disregardedEntityName);
  form.getTextField(W9_FIELDS.exemptPayeeCode).setText(args.tax.exemptPayeeCode);
  form.getTextField(W9_FIELDS.fatcaCode).setText(args.tax.fatcaExemptionCode);
  form.getTextField(W9_FIELDS.address).setText(args.tax.address);
  form.getTextField(W9_FIELDS.cityStateZip).setText(args.tax.cityStateZip);
  form.getTextField(W9_FIELDS.accountNumbers).setText(args.tax.accountNumbers);
  form.getTextField(W9_FIELDS.llcLetter).setText("");
  form.getTextField(W9_FIELDS.otherDescription).setText("");

  if (args.tax.federalTaxClassification) {
    form.getCheckBox(classificationCheckbox(args.tax.federalTaxClassification)).check();
  }
  if (args.tax.federalTaxClassification === "llc") {
    form.getTextField(W9_FIELDS.llcLetter).setText(args.tax.llcTaxClassification);
  }
  if (args.tax.federalTaxClassification === "other") {
    form.getTextField(W9_FIELDS.otherDescription).setText(args.tax.otherClassification);
  }
  if (args.tax.foreignPartners) form.getCheckBox(W9_FIELDS.foreignPartners).check();

  form.getTextField(W9_FIELDS.ssn1).setText("");
  form.getTextField(W9_FIELDS.ssn2).setText("");
  form.getTextField(W9_FIELDS.ssn3).setText("");
  form.getTextField(W9_FIELDS.ein1).setText("");
  form.getTextField(W9_FIELDS.ein2).setText("");
  if (args.tin) writeTinBoxes(form, args.tin);

  try {
    form.updateFieldAppearances();
  } catch {
    throw new Error("W-9 fields could not be drawn");
  }

  if (args.signature.mode === "typed") {
    await drawTypedSignature(pdf, args.signature.name, args.signature.date);
  }

  return pdf.save();
}

function setTinBox(form: ReturnType<PDFDocument["getForm"]>, field: string, value: string): void {
  try {
    form.getTextField(field).setText(value);
  } catch {
    throw new Error("W-9 taxpayer identification number could not be written");
  }
}

function writeTinBoxes(form: ReturnType<PDFDocument["getForm"]>, tin: ParsedTin): void {
  const digits = tin.digits;
  if (digits.length !== 9) throw new W9InputError("Enter a 9-digit taxpayer identification number.");
  if (tin.kind === "ssn") {
    setTinBox(form, W9_FIELDS.ssn1, digits.slice(0, 3));
    setTinBox(form, W9_FIELDS.ssn2, digits.slice(3, 5));
    setTinBox(form, W9_FIELDS.ssn3, digits.slice(5));
    return;
  }
  setTinBox(form, W9_FIELDS.ein1, digits.slice(0, 2));
  setTinBox(form, W9_FIELDS.ein2, digits.slice(2));
}

/**
 * Rev. March 2024 page 1, PDF user space (origin bottom-left, 612×792).
 * Measured from the template's rules, not from a screenshot:
 * the Sign Here row runs from y=216 (top rule) to y=192.5 (bottom rule).
 * "Signature of U.S. person" ends near x=116. "Date" ends near x=400.
 * Both sit on the bottom rule (y=192.5). The script baseline is y=196 so Great Vibes
 * descenders land on that rule. The date is Helvetica with baseline y=192.5, on
 * the same rule, because a date has no descenders.
 *
 * These numbers live only in this file. The platform template uploader
 * checks AcroForm field names and does not move this drawing. A future IRS
 * revision that shifts the signature row needs them updated.
 */
const W9_SIGNATURE_NAME_X = 124;
const W9_SIGNATURE_DATE_X = 408;
const W9_SIGNATURE_BASELINE_Y = 196;
/** Helvetica has no descenders in a date, so its baseline is the rule. */
const W9_SIGNATURE_DATE_Y = 192.5;
const W9_SIGNATURE_NAME_SIZE = 16;
const W9_SIGNATURE_DATE_SIZE = 10;

type FontkitLike = {
  create: (buffer: Uint8Array | ArrayBuffer, postscriptName?: string) => unknown;
};

/** tsx exposes create on the module. Next's server bundle puts it on default. */
function resolveFontkit(): FontkitLike {
  const ns = fontkitNs as unknown as FontkitLike & { default?: FontkitLike };
  if (typeof ns.create === "function") return ns;
  if (ns.default && typeof ns.default.create === "function") return ns.default;
  throw new Error("W-9 signature font could not be loaded");
}

function loadScriptFont(): Uint8Array {
  return readFileSync(join(process.cwd(), "src/lib/fonts/GreatVibes-Regular.ttf"));
}

async function drawTypedSignature(pdf: PDFDocument, name: string, date: string): Promise<void> {
  const page = pdf.getPages()[0];
  pdf.registerFontkit(resolveFontkit() as unknown as Parameters<PDFDocument["registerFontkit"]>[0]);
  const signatureFont = await pdf.embedFont(loadScriptFont(), { subset: true });
  const dateFont = await pdf.embedFont(StandardFonts.Helvetica);
  const color = rgb(0.05, 0.08, 0.2);
  page.drawText(name.slice(0, 80), {
    x: W9_SIGNATURE_NAME_X,
    y: W9_SIGNATURE_BASELINE_Y,
    size: W9_SIGNATURE_NAME_SIZE,
    font: signatureFont,
    color,
  });
  page.drawText(date, {
    x: W9_SIGNATURE_DATE_X,
    y: W9_SIGNATURE_DATE_Y,
    size: W9_SIGNATURE_DATE_SIZE,
    font: dateFont,
    color,
  });
}
