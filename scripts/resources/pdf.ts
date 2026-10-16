import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkitNs from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { itemText, type Block, type ChecklistItem, type FieldItem } from "./blocks";
import { AUTHOR, BRAND, BUILD_DATE, FOOTER_TEXT, type DocMeta } from "./brand";

/** US Letter, 0.75in side margins. */
export const PAGE_W = 612;
export const PAGE_H = 792;
export const MX = 54;
export const CW = PAGE_W - MX * 2;
const TOP = 50;
const BOTTOM = 62;

const ROOT = path.resolve(__dirname, "..", "..");

type FontkitLike = { create: (buffer: Uint8Array | ArrayBuffer, postscriptName?: string) => unknown };

function resolveFontkit(): FontkitLike {
  const ns = fontkitNs as unknown as FontkitLike & { default?: FontkitLike };
  if (typeof ns.create === "function") return ns;
  if (ns.default && typeof ns.default.create === "function") return ns.default;
  throw new Error("fontkit could not be loaded");
}

export function hex(value: string): RGB {
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}

const C = Object.fromEntries(Object.entries(BRAND).map(([k, v]) => [k, hex(v)])) as Record<keyof typeof BRAND, RGB>;

type BoxOpts = { fill?: RGB; border?: RGB; borderWidth?: number; radius?: number; dash?: number[] };

export class PdfCanvas {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];

  private constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly meta: DocMeta,
  ) {}

  static async create(meta: DocMeta): Promise<PdfCanvas> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(resolveFontkit() as unknown as Parameters<PDFDocument["registerFontkit"]>[0]);
    const regular = await doc.embedFont(readFileSync(path.join(ROOT, "public/fonts/Inter-Regular.ttf")), {
      subset: true,
      customName: "Inter",
    });
    const bold = await doc.embedFont(readFileSync(path.join(ROOT, "public/fonts/Inter-Bold.ttf")), {
      subset: true,
      customName: "Inter-Bold",
    });
    doc.setTitle(meta.title, { showInWindowTitleBar: true });
    doc.setSubject(meta.subject);
    doc.setAuthor(AUTHOR);
    doc.setCreator(AUTHOR);
    doc.setProducer(AUTHOR);
    doc.setKeywords(meta.keywords);
    doc.setCreationDate(BUILD_DATE);
    doc.setModificationDate(BUILD_DATE);
    doc.setLanguage("en-US");
    const canvas = new PdfCanvas(doc, regular, bold, meta);
    canvas.newPage();
    return canvas;
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - TOP;
    if (this.pages.length > 1) {
      this.text(this.meta.runningTitle, MX, this.y - 8, 8, this.bold, C.muted);
      this.hline(MX, MX + CW, this.y - 16, C.line, 0.75);
      this.y -= 34;
    }
  }

  atPageTop(): boolean {
    const top = PAGE_H - TOP - (this.pages.length > 1 ? 34 : 0);
    return this.y >= top - 1;
  }

  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  width(s: string, size: number, font: PDFFont = this.regular): number {
    return font.widthOfTextAtSize(s, size);
  }

  wrap(s: string, size: number, maxWidth: number, font: PDFFont = this.regular): string[] {
    const out: string[] = [];
    for (const para of s.split("\n")) {
      const words = para.split(/ +/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.width(candidate, size, font) <= maxWidth || !line) {
          line = candidate;
        } else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(s: string, x: number, baseline: number, size: number, font: PDFFont = this.regular, color: RGB = C.body): void {
    if (!s) return;
    this.page.drawText(s, { x, y: baseline, size, font, color });
  }

  textRight(s: string, right: number, baseline: number, size: number, font: PDFFont = this.regular, color: RGB = C.body): void {
    this.text(s, right - this.width(s, size, font), baseline, size, font, color);
  }

  textCenter(s: string, center: number, baseline: number, size: number, font: PDFFont = this.regular, color: RGB = C.body): void {
    this.text(s, center - this.width(s, size, font) / 2, baseline, size, font, color);
  }

  /** Lines laid out from a top edge; returns the height used. */
  lines(lines: string[], x: number, top: number, size: number, lh: number, font: PDFFont = this.regular, color: RGB = C.body): number {
    lines.forEach((line, i) => this.text(line, x, top - i * lh - lh / 2 - size * 0.36, size, font, color));
    return lines.length * lh;
  }

  hline(x1: number, x2: number, y: number, color: RGB = C.line, thickness = 0.75): void {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  vline(x: number, y1: number, y2: number, color: RGB = C.line, thickness = 0.75): void {
    this.page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color });
  }

  /** Box from its top-left corner (PDF y). */
  box(x: number, top: number, w: number, h: number, o: BoxOpts): void {
    const r = Math.min(o.radius ?? 0, w / 2, h / 2);
    if (r <= 0) {
      this.page.drawRectangle({
        x,
        y: top - h,
        width: w,
        height: h,
        color: o.fill,
        borderColor: o.border,
        borderWidth: o.border ? o.borderWidth ?? 0.75 : 0,
        borderDashArray: o.dash,
      });
      return;
    }
    const k = 0.4477 * r;
    const p = [
      `M ${r} 0`,
      `L ${w - r} 0`,
      `C ${w - k} 0 ${w} ${k} ${w} ${r}`,
      `L ${w} ${h - r}`,
      `C ${w} ${h - k} ${w - k} ${h} ${w - r} ${h}`,
      `L ${r} ${h}`,
      `C ${k} ${h} 0 ${h - k} 0 ${h - r}`,
      `L 0 ${r}`,
      `C 0 ${k} ${k} 0 ${r} 0`,
      "Z",
    ].join(" ");
    this.page.drawSvgPath(p, {
      x,
      y: top,
      color: o.fill,
      borderColor: o.border,
      borderWidth: o.border ? o.borderWidth ?? 0.75 : 0,
      borderDashArray: o.dash,
    });
  }

  checkbox(x: number, top: number, size = 9): void {
    this.box(x, top, size, size, { fill: C.white, border: C.faint, borderWidth: 0.9, radius: 1.8 });
  }

  async save(): Promise<Uint8Array> {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      this.page = page;
      this.hline(MX, MX + CW, 46, C.line, 0.5);
      this.text(FOOTER_TEXT, MX, 32, 7.5, this.regular, C.faint);
      if (total > 1) this.textRight(`Page ${i + 1} of ${total}`, MX + CW, 32, 7.5, this.regular, C.faint);
    });
    return this.doc.save({ useObjectStreams: true });
  }
}

/* ------------------------------------------------------------------ */
/* Block renderer                                                      */
/* ------------------------------------------------------------------ */

const S = {
  body: 9.5,
  bodyLh: 14,
  label: 7.5,
  small: 8.5,
};

function columnsLayout(count: number, gutter: number, width = CW, x0 = MX): Array<{ x: number; w: number }> {
  const w = (width - gutter * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * (w + gutter), w }));
}

function renderHeader(c: PdfCanvas, b: Extract<Block, { kind: "header" }>): void {
  const top = c.y;
  const logoW = 128;
  const logoH = 58;
  const textW = b.logoBox ? CW - logoW - 32 : CW;

  c.box(MX, top, 26, 3, { fill: C.indigo, radius: 1.5 });
  let y = top - 14;
  c.text(b.eyebrow, MX, y - 8, 8.5, c.bold, C.indigo);
  y -= 16;
  const titleLines = c.wrap(b.title, 24, textW, c.bold);
  y -= c.lines(titleLines, MX, y, 24, 29, c.bold, C.slate);
  if (b.subtitle) {
    y -= 4;
    y -= c.lines(c.wrap(b.subtitle, 10, textW), MX, y, 10, 14.5, c.regular, C.body);
  }
  if (b.logoBox) {
    const lx = MX + CW - logoW;
    c.box(lx, top, logoW, logoH, { border: C.lineStrong, borderWidth: 0.9, radius: 8, dash: [3, 2.5] });
    c.textCenter("Your logo", lx + logoW / 2, top - logoH / 2 - 3, 8.5, c.regular, C.faint);
    y = Math.min(y, top - logoH);
  }
  c.y = y - 20;

  if (b.meta?.length) {
    const h = 42;
    c.box(MX, c.y, CW, h, { fill: C.bgLight, border: C.line, radius: 8 });
    const cols = columnsLayout(b.meta.length, 0);
    cols.forEach((col, i) => {
      const item = b.meta![i];
      const pad = 14;
      if (i > 0) c.vline(col.x, c.y - 9, c.y - h + 9, C.line, 0.75);
      c.text(item.label, col.x + pad, c.y - 14, S.label, c.regular, C.muted);
      if (item.value) c.text(item.value, col.x + pad, c.y - 31, 10, c.bold, C.slate);
      else c.hline(col.x + pad, col.x + col.w - pad, c.y - 31, C.lineStrong, 0.6);
    });
    c.y -= h + 20;
  }
}

/** Height of the first unbreakable chunk of a block, so headings stay with their content. */
function leadHeight(c: PdfCanvas, b: Block | undefined): number {
  if (!b) return 0;
  switch (b.kind) {
    case "checkGroups":
      return Math.max(...measureGroups(c, b).slice(0, 2).map((m) => m.h)) + 10;
    case "table":
      return 24 + (b.rowHeight ?? 24) * 2;
    case "prompt": {
      const g = b.guidance ? c.wrap(b.guidance, 8.5, CW).length * 12 + 2 : 0;
      return (b.label ? 15 : 0) + g + 4 + b.lines * 20 + 6;
    }
    case "fields":
      return 34;
    case "parties":
      return 18 + Math.max(...b.parties.map((p) => p.fields.length)) * 30;
    case "checklist":
      return 36;
    case "cards":
      return 200;
    default:
      return 40;
  }
}

function renderSection(c: PdfCanvas, b: Extract<Block, { kind: "section" }>, next?: Block): void {
  if (b.pageBreakBefore && !c.atPageTop()) c.newPage();
  const introLines = b.intro ? c.wrap(b.intro, 9, CW) : [];
  const before = c.atPageTop() ? 0 : 20;
  c.ensure(before + 31 + (introLines.length ? introLines.length * 13 + 6 : 0) + leadHeight(c, next));
  if (!c.atPageTop()) c.y -= before;
  let x = MX;
  if (b.number !== undefined) {
    const label = String(b.number).padStart(2, "0");
    c.text(label, MX, c.y - 12, 9.5, c.bold, C.indigo);
    x = MX + 22;
  }
  c.text(b.title, x, c.y - 12.5, 13, c.bold, C.slate);
  c.y -= 21;
  c.hline(MX, MX + CW, c.y, C.line, 0.75);
  c.y -= 10;
  if (introLines.length) {
    c.y -= c.lines(introLines, MX, c.y, 9, 13, c.regular, C.muted);
    c.y -= 6;
  }
}

function renderParagraph(c: PdfCanvas, b: Extract<Block, { kind: "paragraph" }>): void {
  const size = b.muted ? 8.5 : S.body;
  const lh = b.muted ? 12.5 : S.bodyLh;
  for (const line of c.wrap(b.text, size, CW)) {
    c.ensure(lh);
    c.y -= c.lines([line], MX, c.y, size, lh, c.regular, b.muted ? C.muted : C.body);
  }
  c.y -= 6;
}

function renderBullets(c: PdfCanvas, b: Extract<Block, { kind: "bullets" }>): void {
  for (const item of b.items) {
    const lines = c.wrap(item, S.body, CW - 14);
    c.ensure(lines.length * S.bodyLh);
    c.page.drawCircle({ x: MX + 3, y: c.y - S.bodyLh / 2, size: 1.7, color: C.indigo });
    c.y -= c.lines(lines, MX + 14, c.y, S.body, S.bodyLh, c.regular, C.body);
    c.y -= 3;
  }
  c.y -= 4;
}

function packRows(items: FieldItem[], columns: number): FieldItem[][] {
  const rows: FieldItem[][] = [];
  let row: FieldItem[] = [];
  let used = 0;
  for (const item of items) {
    const span = Math.min(item.span ?? 1, columns);
    if (used + span > columns) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(item);
    used += span;
  }
  if (row.length) rows.push(row);
  return rows;
}

function renderFields(c: PdfCanvas, b: Extract<Block, { kind: "fields" }>): void {
  const gutter = 18;
  const unit = (CW - gutter * (b.columns - 1)) / b.columns;
  const rowH = 34;
  for (const row of packRows(b.items, b.columns)) {
    c.ensure(rowH);
    let x = MX;
    for (const item of row) {
      const span = Math.min(item.span ?? 1, b.columns);
      const w = unit * span + gutter * (span - 1);
      c.text(item.label, x, c.y - 9, S.label, c.regular, C.muted);
      if (item.value) c.text(item.value, x, c.y - 25, 10, c.regular, C.slate);
      c.hline(x, x + w, c.y - 29, C.lineStrong, 0.75);
      x += w + gutter;
    }
    c.y -= rowH;
  }
  c.y -= 6;
}

function renderParties(c: PdfCanvas, b: Extract<Block, { kind: "parties" }>): void {
  const cols = columnsLayout(b.parties.length, 28);
  const rows = Math.max(...b.parties.map((p) => p.fields.length));
  const fieldH = 30;
  const h = 18 + rows * fieldH;
  c.ensure(h);
  b.parties.forEach((party, i) => {
    const col = cols[i];
    c.text(party.title, col.x, c.y - 9, 8.5, c.bold, C.indigo);
    party.fields.forEach((label, j) => {
      const top = c.y - 18 - j * fieldH;
      c.text(label, col.x, top - 9, S.label, c.regular, C.muted);
      c.hline(col.x, col.x + col.w, top - 26, C.lineStrong, 0.75);
    });
  });
  c.y -= h + 8;
}

function renderPrompt(c: PdfCanvas, b: Extract<Block, { kind: "prompt" }>): void {
  const guidance = b.guidance ? c.wrap(b.guidance, 8.5, CW) : [];
  const lineGap = 20;
  const boxH = b.lines * lineGap + 6;
  c.ensure((b.label ? 17 : 0) + guidance.length * 12 + boxH + 12);
  if (b.label) {
    c.y -= c.lines([b.label], MX, c.y, 10, 15, c.bold, C.slate);
  }
  if (guidance.length) {
    c.y -= c.lines(guidance, MX, c.y, 8.5, 12, c.regular, C.muted);
    c.y -= 2;
  }
  c.y -= 4;
  c.box(MX, c.y, CW, boxH, { fill: C.bgLight, border: C.line, radius: 6 });
  for (let i = 1; i < b.lines + 1; i++) {
    const ly = c.y - i * lineGap;
    if (ly > c.y - boxH + 4) c.hline(MX + 12, MX + CW - 12, ly, C.line, 0.6);
  }
  c.y -= boxH + 12;
}

function renderTable(c: PdfCanvas, b: Extract<Block, { kind: "table" }>): void {
  const totalW = b.columns.reduce((s, col) => s + col.width, 0);
  let x = MX;
  const cols = b.columns.map((col) => {
    const w = (col.width / totalW) * CW;
    const out = { ...col, x, w };
    x += w;
    return out;
  });
  const pad = 10;
  const headH = 24;
  const minRow = b.rowHeight ?? 24;
  const size = 9;
  const lh = 12.5;

  const drawHead = () => {
    c.box(MX, c.y, CW, headH, { fill: C.bgIndigo, radius: 6 });
    for (const col of cols) {
      const base = c.y - headH / 2 - 3;
      if (col.align === "right") c.textRight(col.header, col.x + col.w - pad, base, 8, c.bold, C.text);
      else if (col.align === "center") c.textCenter(col.header, col.x + col.w / 2, base, 8, c.bold, C.text);
      else c.text(col.header, col.x + pad, base, 8, c.bold, C.text);
    }
    c.y -= headH;
  };

  c.ensure(headH + minRow * 2);
  drawHead();
  const rows: string[][] = [...(b.rows ?? []), ...Array.from({ length: b.blankRows ?? 0 }, () => [])];
  for (const row of rows) {
    const cellLines = cols.map((col, i) => (row[i] ? c.wrap(row[i], size, col.w - pad * 2) : []));
    const h = Math.max(minRow, ...cellLines.map((l) => l.length * lh + 11));
    if (c.y - h < BOTTOM) {
      c.newPage();
      drawHead();
    }
    cols.forEach((col, i) => {
      const lines = cellLines[i];
      const top = c.y - (h - lines.length * lh) / 2;
      lines.forEach((line, j) => {
        const base = top - j * lh - lh / 2 - size * 0.36;
        const font = i === 0 ? c.regular : c.regular;
        const color = i === 0 ? C.ink : C.body;
        if (col.align === "right") c.textRight(line, col.x + col.w - pad, base, size, font, color);
        else if (col.align === "center") c.textCenter(line, col.x + col.w / 2, base, size, font, color);
        else c.text(line, col.x + pad, base, size, font, color);
      });
    });
    c.y -= h;
    c.hline(MX, MX + CW, c.y, C.line, 0.75);
  }

  if (b.totals?.length) {
    const w = 232;
    const tx = MX + CW - w;
    const rowH = 22;
    c.y -= 8;
    const asideH = b.aside ? 18 + b.aside.fields.length * 30 : 0;
    c.ensure(Math.max(rowH * b.totals.length, asideH));
    const startY = c.y;
    if (b.aside) {
      const aw = CW - w - 32;
      c.text(b.aside.title, MX, c.y - 14, 8.5, c.bold, C.indigo);
      b.aside.fields.forEach((label, j) => {
        const top = c.y - 22 - j * 30;
        c.text(label, MX, top - 9, S.label, c.regular, C.muted);
        c.hline(MX, MX + aw, top - 26, C.lineStrong, 0.75);
      });
    }
    for (const t of b.totals) {
      if (t.emphasis) c.box(tx, c.y, w, rowH, { fill: C.bgIndigo, radius: 5 });
      const base = c.y - rowH / 2 - 3.2;
      const strong = t.emphasis || t.strong;
      c.text(t.label, tx + pad, base, 9, strong ? c.bold : c.regular, strong ? C.slate : C.body);
      if (t.value) c.textRight(t.value, tx + w - pad, base, 9, c.bold, C.slate);
      c.y -= rowH;
      if (!t.emphasis) c.hline(tx, tx + w, c.y, C.line, 0.6);
    }
    c.y = Math.min(c.y, startY - asideH);
  }
  if (b.note) {
    c.y -= 6;
    const lines = c.wrap(b.note, 8, CW);
    c.ensure(lines.length * 11.5);
    c.y -= c.lines(lines, MX, c.y, 8, 11.5, c.regular, C.muted);
  }
  c.y -= 10;
}

type MeasuredItem = { text: string[]; hint: string[]; h: number };

function measureItems(c: PdfCanvas, items: ChecklistItem[], width: number): MeasuredItem[] {
  return items.map((raw) => {
    const item = itemText(raw);
    const text = c.wrap(item.text, 9.5, width - 17);
    const hint = item.hint ? c.wrap(item.hint, 8, width - 17) : [];
    return { text, hint, h: text.length * 13 + hint.length * 11 + 4.5 };
  });
}

function drawItem(c: PdfCanvas, m: MeasuredItem, x: number, top: number): void {
  c.checkbox(x, top - 2);
  let y = top;
  y -= c.lines(m.text, x + 17, y, 9.5, 13, c.regular, C.ink);
  if (m.hint.length) c.lines(m.hint, x + 17, y, 8, 11, c.regular, C.muted);
}

function renderChecklist(c: PdfCanvas, b: Extract<Block, { kind: "checklist" }>): void {
  const cols = columnsLayout(b.columns, 24);
  const measured = measureItems(c, b.items, cols[0].w);
  if (b.columns === 1) {
    for (const m of measured) {
      c.ensure(m.h);
      drawItem(c, m, MX, c.y);
      c.y -= m.h;
    }
  } else {
    const half = Math.ceil(measured.length / 2);
    const left = measured.slice(0, half);
    const right = measured.slice(half);
    for (let i = 0; i < half; i++) {
      const h = Math.max(left[i].h, right[i]?.h ?? 0);
      c.ensure(h);
      drawItem(c, left[i], cols[0].x, c.y);
      if (right[i]) drawItem(c, right[i], cols[1].x, c.y);
      c.y -= h;
    }
  }
  c.y -= 6;
}

const GROUP_PAD = 13;

function measureGroups(c: PdfCanvas, b: Extract<Block, { kind: "checkGroups" }>) {
  const w = columnsLayout(2, 14)[0].w;
  return b.groups.map((g) => {
    const items = measureItems(c, g.items, w - GROUP_PAD * 2);
    return { g, items, h: GROUP_PAD + 17 + items.reduce((s, m) => s + m.h, 0) + GROUP_PAD - 4 };
  });
}

function renderCheckGroups(c: PdfCanvas, b: Extract<Block, { kind: "checkGroups" }>): void {
  const cols = columnsLayout(2, 14);
  const pad = GROUP_PAD;
  const measured = measureGroups(c, b);
  for (let i = 0; i < measured.length; i += 2) {
    const pair = measured.slice(i, i + 2);
    const h = Math.max(...pair.map((p) => p.h));
    c.ensure(h + 10);
    pair.forEach((p, j) => {
      const col = cols[j];
      c.box(col.x, c.y, col.w, h, { fill: C.white, border: C.line, radius: 8 });
      let y = c.y - pad;
      c.text(p.g.title, col.x + pad, y - 9, 10, c.bold, C.slate);
      if (p.g.tag) {
        const tw = c.width(p.g.tag, 7, c.bold) + 12;
        c.box(col.x + col.w - pad - tw, y - 0.5, tw, 13, { fill: C.bgIndigo, radius: 6.5 });
        c.textCenter(p.g.tag, col.x + col.w - pad - tw / 2, y - 9, 7, c.bold, C.indigoDark);
      }
      y -= 17;
      for (const m of p.items) {
        drawItem(c, m, col.x + pad, y);
        y -= m.h;
      }
    });
    c.y -= h + 10;
  }
}

function renderCards(c: PdfCanvas, b: Extract<Block, { kind: "cards" }>): void {
  const cols = columnsLayout(b.cards.length, 12);
  const pad = 14;
  const band = 30;
  const measured = b.cards.map((card, i) => {
    const w = cols[i].w - pad * 2;
    const sub = card.subtitle ? c.wrap(card.subtitle, 8.5, w) : [];
    const items = card.items.map((it) => c.wrap(it, 8.75, w - 11));
    const itemsH = items.reduce((s, l) => s + l.length * 12 + 3, 0);
    return { card, sub, items, h: pad + 8 + 17 + sub.length * 12 + 10 + band + 10 + itemsH + pad - 3 };
  });
  const h = Math.max(...measured.map((m) => m.h));
  c.ensure(h + 8);
  measured.forEach((m, i) => {
    const col = cols[i];
    const x = col.x + pad;
    c.box(col.x, c.y, col.w, h, { fill: C.white, border: C.line, radius: 10 });
    let y = c.y - pad;
    c.box(x, y, 20, 3, { fill: C.indigo, radius: 1.5 });
    y -= 8;
    y -= c.lines([m.card.title], x, y, 13, 17, c.bold, C.slate);
    if (m.sub.length) y -= c.lines(m.sub, x, y, 8.5, 12, c.regular, C.muted);
    y -= 10;
    // Price band: a writable area with a currency mark.
    c.box(col.x + 0.5, y, col.w - 1, band, { fill: C.bgLight });
    c.hline(col.x + 0.5, col.x + col.w - 0.5, y, C.line, 0.6);
    c.hline(col.x + 0.5, col.x + col.w - 0.5, y - band, C.line, 0.6);
    c.text(m.card.price ?? "$", x, y - 21, 15, c.bold, C.slate);
    if (m.card.priceNote) c.textRight(m.card.priceNote, col.x + col.w - pad, y - 19, 7.5, c.regular, C.muted);
    y -= band + 10;
    for (const lines of m.items) {
      c.page.drawCircle({ x: x + 2.5, y: y - 6, size: 1.6, color: C.indigo });
      y -= c.lines(lines, x + 11, y, 8.75, 12, c.regular, C.text);
      y -= 3;
    }
  });
  c.y -= h + 10;
}

function renderNote(c: PdfCanvas, b: Extract<Block, { kind: "note" }>): void {
  const pad = 12;
  const lines = c.wrap(b.text, 8.5, CW - pad * 2);
  const h = pad * 2 + (b.title ? 14 : 0) + lines.length * 12.5 - 2;
  c.ensure(h + 8);
  c.box(MX, c.y, CW, h, { fill: b.tone === "muted" ? C.bgLight : C.bgIndigo, radius: 8 });
  let y = c.y - pad;
  if (b.title) {
    c.text(b.title, MX + pad, y - 9, 8.5, c.bold, C.slate);
    y -= 14;
  }
  c.lines(lines, MX + pad, y, 8.5, 12.5, c.regular, C.body);
  c.y -= h + 12;
}

function renderSignature(c: PdfCanvas, b: Extract<Block, { kind: "signature" }>): void {
  const cols = columnsLayout(b.items.length, 24);
  c.ensure(60);
  c.y -= 34;
  cols.forEach((col, i) => {
    c.hline(col.x, col.x + col.w, c.y, C.lineStrong, 0.9);
    c.text(b.items[i], col.x, c.y - 12, S.label, c.regular, C.muted);
  });
  c.y -= 24;
}

export async function renderPdf(meta: DocMeta, blocks: Block[]): Promise<{ bytes: Uint8Array; pages: number }> {
  const c = await PdfCanvas.create(meta);
  for (const [i, b] of blocks.entries()) {
    switch (b.kind) {
      case "header":
        renderHeader(c, b);
        break;
      case "section":
        renderSection(c, b, blocks[i + 1]);
        break;
      case "paragraph":
        renderParagraph(c, b);
        break;
      case "bullets":
        renderBullets(c, b);
        break;
      case "fields":
        renderFields(c, b);
        break;
      case "parties":
        renderParties(c, b);
        break;
      case "prompt":
        renderPrompt(c, b);
        break;
      case "table":
        renderTable(c, b);
        break;
      case "checklist":
        renderChecklist(c, b);
        break;
      case "checkGroups":
        renderCheckGroups(c, b);
        break;
      case "cards":
        renderCards(c, b);
        break;
      case "note":
        renderNote(c, b);
        break;
      case "signature":
        renderSignature(c, b);
        break;
      case "spacer":
        c.y -= b.size;
        break;
      case "pageBreak":
        c.newPage();
        break;
    }
  }
  const bytes = await c.save();
  return { bytes, pages: c.pages.length };
}
