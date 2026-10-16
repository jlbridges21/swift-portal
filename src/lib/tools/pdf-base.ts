/**
 * Shared drawing kit for the free tools' PDFs (quote, invoice, price sheet). Client-side only,
 * loaded with dynamic import() when the visitor clicks Download, so pdf-lib never ships in the
 * page bundle. Uses the site's Inter font (public/fonts) so the PDF matches the live preview.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Brand } from "@/lib/tools/brand";

export const INK = rgb(15 / 255, 23 / 255, 42 / 255);
export const BODY = rgb(71 / 255, 85 / 255, 105 / 255);
export const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
export const RULE = rgb(226 / 255, 232 / 255, 240 / 255);
export const ACCENT = rgb(79 / 255, 70 / 255, 229 / 255);
export const ACCENT_DARK = rgb(55 / 255, 48 / 255, 163 / 255);
export const TINT = rgb(238 / 255, 242 / 255, 255 / 255);
export const CLOUD = rgb(248 / 255, 250 / 255, 252 / 255);

export const PAGE_W = 612; // US Letter
export const PAGE_H = 792;
export const M = 54;
const FOOTER = 30;

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let lineText = "";
    for (const w of words) {
      const next = lineText ? `${lineText} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) lineText = next;
      else {
        if (lineText) out.push(lineText);
        // Hard-break very long words (URLs).
        let rest = w;
        while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
          let i = rest.length;
          while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
          out.push(rest.slice(0, i));
          rest = rest.slice(i);
        }
        lineText = rest;
      }
    }
    out.push(lineText);
  }
  return out;
}

export class PdfWriter {
  y = PAGE_H - M;
  page: PDFPage;

  private constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont
  ) {
    this.page = this.addPage();
  }

  static async create(title: string, author: string): Promise<PdfWriter> {
    const [regularBytes, boldBytes] = await Promise.all([
      fetch("/fonts/Inter-Regular.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/Inter-Bold.ttf").then((r) => r.arrayBuffer()),
    ]);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(regularBytes, { subset: true });
    const bold = await doc.embedFont(boldBytes, { subset: true });
    doc.setTitle(title);
    doc.setAuthor(author);
    doc.setCreator("ShootPortal free tools");
    return new PdfWriter(doc, regular, bold);
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([PAGE_W, PAGE_H]);
    // Thin accent band across the top of every page.
    page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: ACCENT });
    return page;
  }

  /** Start a new page when fewer than `needed` points remain above the footer. */
  ensure(needed: number) {
    if (this.y - needed < M + FOOTER) {
      this.page = this.addPage();
      this.y = PAGE_H - M;
    }
  }

  text(s: string, x: number, y: number, size = 10, font: PDFFont = this.regular, color: RGB = INK) {
    this.page.drawText(s, { x, y, size, font, color });
  }

  right(s: string, xRight: number, y: number, size = 10, font: PDFFont = this.regular, color: RGB = INK) {
    this.page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y, size, font, color });
  }

  rule(y: number, x1 = M, x2 = PAGE_W - M, color: RGB = RULE, thickness = 0.75) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  /** Paragraph that flows across pages line by line. */
  paragraph(body: string, size = 9.5, color: RGB = BODY, width = PAGE_W - 2 * M, x = M) {
    for (const l of wrap(body, this.regular, size, width)) {
      this.ensure(size + 4);
      this.text(l, x, this.y, size, this.regular, color);
      this.y -= size + 3.5;
    }
  }

  /** Small section heading; keeps at least `keep` points of content with it. */
  heading(title: string, keep = 30) {
    this.ensure(18 + keep);
    this.text(title, M, this.y, 11, this.bold);
    this.y -= 16;
  }

  async logo(dataUrl: string | null, x: number, top: number, maxW: number, maxH: number): Promise<number> {
    if (!dataUrl) return 0;
    try {
      const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
      const img = dataUrl.startsWith("data:image/png") ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const h = img.height * scale;
      this.page.drawImage(img, { x, y: top - h, width: img.width * scale, height: h });
      return h;
    } catch {
      return 0; // an unreadable logo is skipped rather than failing the whole export
    }
  }

  /**
   * Letterhead: logo and business details on the left, document title and key facts on the
   * right. Leaves `y` just below a divider.
   */
  async header(brand: Brand, title: string, meta: [string, string][]) {
    const top = this.y;
    const logoH = await this.logo(brand.logo, M, top, 170, 56);
    let ly = top - (logoH ? logoH + 16 : 4);
    for (const l of wrap(brand.name || "Your business name", this.bold, 14, 290).slice(0, 2)) {
      this.text(l, M, ly, 14, this.bold);
      ly -= 17;
    }
    for (const info of [brand.address, [brand.phone, brand.email].filter(Boolean).join("  ·  "), brand.website].filter(Boolean)) {
      for (const l of wrap(info, this.regular, 9, 290).slice(0, 2)) {
        this.text(l, M, ly, 9, this.regular, BODY);
        ly -= 12;
      }
    }

    this.right(title, PAGE_W - M, top - 20, 24, this.bold, ACCENT);
    let my = top - 42;
    for (const [k, v] of meta) {
      if (!v) continue;
      const vw = this.bold.widthOfTextAtSize(v, 9.5);
      this.right(v, PAGE_W - M, my, 9.5, this.bold, INK);
      this.right(k, PAGE_W - M - vw - 8, my, 9.5, this.regular, MUTED);
      my -= 14;
    }
    this.y = Math.min(ly, my) - 10;
    this.rule(this.y);
    this.y -= 24;
  }

  /** Two labelled columns (e.g. "Bill to" and "Project"). */
  parties(left: { label: string; lines: string[] }, right: { label: string; lines: string[] }) {
    const col2 = M + (PAGE_W - 2 * M) / 2 + 10;
    this.text(left.label, M, this.y, 8.5, this.regular, MUTED);
    this.text(right.label, col2, this.y, 8.5, this.regular, MUTED);
    this.y -= 15;
    const rows = Math.max(left.lines.length, right.lines.length);
    for (let i = 0; i < rows; i++) {
      const font = i ? this.regular : this.bold;
      const color = i ? BODY : INK;
      if (left.lines[i]) this.text(wrap(left.lines[i]!, font, 10, 230)[0] ?? "", M, this.y, 10, font, color);
      if (right.lines[i]) this.text(wrap(right.lines[i]!, font, 10, 230)[0] ?? "", col2, this.y, 10, font, color);
      this.y -= 14;
    }
    this.y -= 10;
    this.rule(this.y);
    this.y -= 24;
  }

  /** Footer with the business name and page numbers on every page. */
  async save(footer: string): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M - 6 }, end: { x: PAGE_W - M, y: M - 6 }, thickness: 0.5, color: RULE });
      if (footer) p.drawText(footer, { x: M, y: M - 20, size: 8, font: this.regular, color: MUTED });
      const label = `Page ${i + 1} of ${pages.length}`;
      p.drawText(label, { x: PAGE_W - M - this.regular.widthOfTextAtSize(label, 8), y: M - 20, size: 8, font: this.regular, color: MUTED });
    });
    return this.doc.save();
  }
}
