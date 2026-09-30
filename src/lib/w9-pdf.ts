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
  tin: ParsedTin;
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
  writeTinBoxes(form, args.tin);

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
 * Rev. March 2024 page 1: "Sign Here" / "Signature of U.S. person" sits just
 * above y≈180pt, and "Date" is to the right. Coordinates are PDF user space
 * (origin bottom-left) measured from that revision's media box.
 */
async function drawTypedSignature(pdf: PDFDocument, name: string, date: string): Promise<void> {
  const page = pdf.getPages()[0];
  const signatureFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const dateFont = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(name.slice(0, 80), {
    x: 112,
    y: 178,
    size: 12,
    font: signatureFont,
    color: rgb(0.05, 0.08, 0.2),
  });
  page.drawText(date, {
    x: 400,
    y: 180,
    size: 10,
    font: dateFont,
    color: rgb(0.05, 0.08, 0.2),
  });
}
