import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AcademyCertificate } from "@/lib/academy/server";

/** ShootPortal Academy certificate: one landscape US Letter page. */

const INDIGO = rgb(0.31, 0.27, 0.9);
const NAVY = rgb(0.04, 0.06, 0.13);
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.53);
const LINE = rgb(0.89, 0.91, 0.94);
const GREEN = rgb(0.09, 0.64, 0.29);

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

function fitSize(text: string, font: PDFFont, size: number, maxWidth: number): number {
  let s = size;
  while (s > 14 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
  return s;
}

export function academyVerifyUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/academy/verify/${code}`;
}

export function academyIssuedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export async function buildAcademyCertificatePdf(cert: AcademyCertificate, verifyUrl: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`ShootPortal Certified: ${cert.holderName}`);
  doc.setAuthor("ShootPortal Academy");
  const page = doc.addPage([792, 612]);
  const W = page.getWidth();
  const H = page.getHeight();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Frame: indigo outer band, navy inner rule, white card.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INDIGO });
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, color: NAVY });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, color: rgb(0.995, 0.995, 1) });

  // Wordmark
  const mark = "ShootPortal";
  const markW = bold.widthOfTextAtSize(mark, 20);
  page.drawRectangle({ x: (W - markW) / 2 - 34, y: H - 103, width: 26, height: 26, color: INDIGO });
  page.drawText("SP", { x: (W - markW) / 2 - 30, y: H - 96, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(mark, { x: (W - markW) / 2, y: H - 97, size: 20, font: bold, color: INK });

  centered(page, "S H O O T P O R T A L   A C A D E M Y", H - 140, bold, 11, INDIGO);
  centered(page, "Certificate of Completion", H - 190, bold, 36, INK);
  centered(page, "This certifies that", H - 225, regular, 13, MUTED);

  const nameSize = fitSize(cert.holderName, italic, 40, W - 200);
  centered(page, cert.holderName, H - 285, italic, nameSize, INK);
  page.drawLine({ start: { x: W / 2 - 200, y: H - 300 }, end: { x: W / 2 + 200, y: H - 300 }, thickness: 1, color: LINE });

  const line1 = cert.businessName
    ? `of ${cert.businessName} has completed all ${cert.lessonCount} lessons of ShootPortal Academy`
    : `has completed all ${cert.lessonCount} lessons of ShootPortal Academy`;
  centered(page, line1, H - 330, regular, fitSize(line1, regular, 13, W - 140), INK);
  centered(page, "and is a ShootPortal Certified operator.", H - 350, bold, 13, INDIGO);

  // Footer: date, verified, code
  const fy = 92;
  page.drawText(academyIssuedLabel(cert.issuedAt), { x: 90, y: fy, size: 13, font: bold, color: INK });
  page.drawText("Date completed", { x: 90, y: fy - 16, size: 10, font: regular, color: MUTED });

  const ver = "Verified";
  const vw = bold.widthOfTextAtSize(ver, 11);
  page.drawRectangle({ x: W / 2 - vw / 2 - 14, y: fy - 6, width: vw + 28, height: 22, color: rgb(0.91, 0.98, 0.94) });
  page.drawText(ver, { x: W / 2 - vw / 2, y: fy + 1, size: 11, font: bold, color: GREEN });

  const cw = bold.widthOfTextAtSize(cert.code, 13);
  page.drawText(cert.code, { x: W - 90 - cw, y: fy, size: 13, font: bold, color: INK });
  const short = verifyUrl.replace(/^https?:\/\//, "");
  const sw = regular.widthOfTextAtSize(`Verify at ${short}`, 9);
  page.drawText(`Verify at ${short}`, { x: W - 90 - sw, y: fy - 16, size: 9, font: regular, color: MUTED });

  return doc.save();
}
