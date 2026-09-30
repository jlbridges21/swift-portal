import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PaymentRecordInput = {
  businessName: string;
  addressLines: string[];
  logoBytes?: Uint8Array | null;
  logoType?: "png" | "jpg" | null;
  clientName: string;
  projectName: string;
  propertyAddress: string;
  amountLabel: string;
  paidAtLabel: string;
  recordedAs: string;
  reference: string;
  cardLast4?: string | null;
};

/** Visible text of the payment record. No invoice title and no sequence number. */
export function paymentRecordLines(input: PaymentRecordInput): string[] {
  return [
    "Payment record",
    input.businessName,
    ...input.addressLines,
    `Client: ${input.clientName}`,
    `Project: ${input.projectName}`,
    `Property: ${input.propertyAddress || "—"}`,
    `Amount: ${input.amountLabel}`,
    `Date paid: ${input.paidAtLabel}`,
    `Recorded as: ${input.recordedAs}`,
    input.cardLast4 ? `Card ending ${input.cardLast4}` : "",
    `Reference: ${input.reference}`,
    "Payment record only. No invoice number is assigned.",
  ].filter((line) => line.trim().length > 0);
}

export async function buildPaymentRecordPdf(input: PaymentRecordInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lines = paymentRecordLines(input);
  let y = 740;

  if (input.logoBytes && input.logoType) {
    try {
      const image =
        input.logoType === "png" ? await doc.embedPng(input.logoBytes) : await doc.embedJpg(input.logoBytes);
      const scale = Math.min(160 / image.width, 48 / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, { x: 54, y: y - height, width, height });
      y -= height + 24;
    } catch {
      // A broken logo must not block the record.
    }
  }

  lines.forEach((line, index) => {
    const isTitle = index === 0;
    page.drawText(line.replace(/[^\x20-\x7E]/g, " "), {
      x: 54,
      y,
      size: isTitle ? 20 : 12,
      font: isTitle || index === 1 ? bold : font,
      color: rgb(0.1, 0.14, 0.2),
    });
    y -= isTitle ? 32 : 20;
  });

  return doc.save();
}
