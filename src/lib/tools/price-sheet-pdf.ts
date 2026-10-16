/**
 * Client-side PDF export for the real estate calculator's price list. Loaded with dynamic
 * import() only when the visitor clicks Download. Mirrors components/tools/price-sheet-document.tsx.
 */
import { formatMoney } from "@/lib/tools/pricing-math";
import { formatDate } from "@/lib/tools/quote-model";
import type { Brand } from "@/lib/tools/brand";
import type { PriceSheet } from "@/lib/tools/defaults";
import { ACCENT, ACCENT_DARK, BODY, M, MUTED, PAGE_W, PdfWriter, RULE, TINT } from "@/lib/tools/pdf-base";

function sizeRange(from: number, upTo: number): string {
  return from ? `${from.toLocaleString("en-US")}–${upTo.toLocaleString("en-US")} sq ft` : `Up to ${upTo.toLocaleString("en-US")} sq ft`;
}

export async function buildPriceSheetPdf(input: { brand: Brand; sheet: PriceSheet; title: string; note: string; issued: string }): Promise<Uint8Array> {
  const { brand, sheet, note, issued } = input;
  const title = input.title || "Real estate photography pricing";
  const w = await PdfWriter.create(`${title}${brand.name ? ` – ${brand.name}` : ""}`, brand.name || "");
  await w.header(brand, "Price list", [["Effective", formatDate(issued)]]);

  w.text(title, M, w.y, 17, w.bold);
  w.y -= 18;
  w.text("Photo packages by home size", M, w.y, 10, w.regular, MUTED);
  w.y -= 24;

  // Package cards, two per row.
  const gap = 14;
  const cw = (PAGE_W - 2 * M - gap) / 2;
  const ch = 104;
  sheet.packages.forEach((p, i) => {
    const col = i % 2;
    if (col === 0) w.ensure(ch + gap);
    const x = M + col * (cw + gap);
    const top = w.y;
    w.page.drawRectangle({ x, y: top - ch, width: cw, height: ch, borderColor: RULE, borderWidth: 1 });
    w.text(p.name, x + 16, top - 24, 11.5, w.bold);
    w.text(sizeRange(p.from, p.upTo), x + 16, top - 39, 9, w.regular, MUTED);
    w.text(formatMoney(p.price, { whole: true }), x + 16, top - 72, 26, w.bold, ACCENT);
    w.text(`${p.photos} edited photos`, x + 16, top - 90, 9, w.regular, BODY);
    if (col === 1 || i === sheet.packages.length - 1) w.y -= ch + gap;
  });

  if (sheet.addOns.length) {
    w.y -= 14;
    w.heading("Add to any package", 24);
    w.rule(w.y + 8);
    for (const a of sheet.addOns) {
      w.ensure(24);
      w.text(a.label, M, w.y - 8, 10.5, w.regular, BODY);
      w.right(formatMoney(a.price, { whole: true }), PAGE_W - M, w.y - 8, 10.5, w.bold);
      w.y -= 24;
      w.rule(w.y + 8, M, PAGE_W - M, RULE, 0.5);
    }
  }

  if (note.trim()) {
    w.y -= 18;
    w.paragraph(note, 10, BODY);
  }

  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join("   ·   ");
  if (contact) {
    w.ensure(50);
    w.y -= 22;
    w.page.drawRectangle({ x: M, y: w.y - 12, width: PAGE_W - 2 * M, height: 32, color: TINT });
    w.text("To book:", M + 14, w.y, 10.5, w.bold, ACCENT_DARK);
    w.text(contact, M + 14 + w.bold.widthOfTextAtSize("To book:", 10.5) + 8, w.y, 10, w.regular, BODY);
    w.y -= 30;
  }

  return w.save(brand.name);
}
