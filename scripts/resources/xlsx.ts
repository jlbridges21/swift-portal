import { BRAND, FOOTER_TEXT } from "./brand";
import { appPropsXml, corePropsXml, esc, XML_HEAD, zipParts } from "./ooxml";

/**
 * Minimal, hand-written SpreadsheetML writer: shared strings, a deduplicated
 * style table, merges, real formulas, list validations, conditional formats
 * and print setup. Enough for templates; not a general-purpose library.
 */

export type XFont = { bold?: boolean; italic?: boolean; size?: number; color?: string };
export type XBorderSide = { color: string; style?: "thin" | "medium" | "hair" | "dashed" };
export type XStyle = {
  font?: XFont;
  fill?: string;
  border?: { top?: XBorderSide; bottom?: XBorderSide; left?: XBorderSide; right?: XBorderSide };
  numFmt?: string;
  h?: "left" | "center" | "right";
  v?: "top" | "center" | "bottom";
  wrap?: boolean;
  indent?: number;
  unlocked?: boolean;
};

const BUILTIN_FMTS: Record<string, number> = {
  General: 0,
  "0": 1,
  "0.00": 2,
  "#,##0": 3,
  "#,##0.00": 4,
  "0%": 9,
  "0.00%": 10,
};

const DEFAULT_FONT: Required<Pick<XFont, "size" | "color">> = { size: 10, color: BRAND.text };

class StyleTable {
  fonts: string[] = [];
  fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders: string[] = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  numFmts: Array<{ id: number; code: string }> = [];
  xfs: string[] = [];
  private xfIndex = new Map<string, number>();
  dxfs: string[] = [];

  constructor() {
    this.font({});
    this.style({});
  }

  private intern(list: string[], xml: string): number {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  }

  font(f: XFont): number {
    const xml =
      "<font>" +
      (f.bold ? "<b/>" : "") +
      (f.italic ? "<i/>" : "") +
      `<sz val="${f.size ?? DEFAULT_FONT.size}"/>` +
      `<color rgb="FF${f.color ?? DEFAULT_FONT.color}"/>` +
      '<name val="Inter"/><family val="2"/>' +
      "</font>";
    return this.intern(this.fonts, xml);
  }

  fill(color?: string): number {
    if (!color) return 0;
    return this.intern(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`);
  }

  border(b?: XStyle["border"]): number {
    if (!b) return 0;
    const side = (tag: string, s?: XBorderSide) =>
      s ? `<${tag} style="${s.style ?? "thin"}"><color rgb="FF${s.color}"/></${tag}>` : `<${tag}/>`;
    return this.intern(this.borders, `<border>${side("left", b.left)}${side("right", b.right)}${side("top", b.top)}${side("bottom", b.bottom)}<diagonal/></border>`);
  }

  numFmt(code?: string): number {
    if (!code) return 0;
    if (code in BUILTIN_FMTS) return BUILTIN_FMTS[code];
    const existing = this.numFmts.find((n) => n.code === code);
    if (existing) return existing.id;
    const id = 164 + this.numFmts.length;
    this.numFmts.push({ id, code });
    return id;
  }

  style(s: XStyle): number {
    const key = JSON.stringify(s);
    const hit = this.xfIndex.get(key);
    if (hit !== undefined) return hit;
    const fontId = this.font(s.font ?? {});
    const fillId = this.fill(s.fill);
    const borderId = this.border(s.border);
    const numFmtId = this.numFmt(s.numFmt);
    const align =
      s.h || s.v || s.wrap || s.indent
        ? `<alignment${s.h ? ` horizontal="${s.h}"` : ""} vertical="${s.v ?? "center"}"${s.wrap ? ' wrapText="1"' : ""}${s.indent ? ` indent="${s.indent}"` : ""}/>`
        : '<alignment vertical="center"/>';
    const protection = s.unlocked ? '<protection locked="0"/>' : "";
    const xml = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${protection ? ' applyProtection="1"' : ""}>${align}${protection}</xf>`;
    this.xfs.push(xml);
    const idx = this.xfs.length - 1;
    this.xfIndex.set(key, idx);
    return idx;
  }

  dxf(o: { color: string; fill: string; bold?: boolean }): number {
    this.dxfs.push(
      `<dxf><font>${o.bold ? "<b/>" : ""}<color rgb="FF${o.color}"/></font><fill><patternFill patternType="solid"><bgColor rgb="FF${o.fill}"/></patternFill></fill></dxf>`,
    );
    return this.dxfs.length - 1;
  }

  xml(): string {
    const numFmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((n) => `<numFmt numFmtId="${n.id}" formatCode="${esc(n.code)}"/>`).join("")}</numFmts>`
      : "";
    return (
      XML_HEAD +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      numFmts +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      `<dxfs count="${this.dxfs.length}">${this.dxfs.join("")}</dxfs>` +
      '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
      "</styleSheet>"
    );
  }
}

export function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function colNumber(letters: string): number {
  return letters.split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

function parseRef(ref: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Bad cell ref ${ref}`);
  return { col: colNumber(m[1]), row: Number(m[2]) };
}

type Cell = { s: number; kind: "empty" | "string" | "number" | "formula"; value?: string | number; formula?: string; cached?: string | number };

export class Sheet {
  readonly cells = new Map<string, Cell>();
  readonly cols: Array<{ min: number; max: number; width: number }> = [];
  readonly heights = new Map<number, number>();
  readonly merges: string[] = [];
  readonly validations: string[] = [];
  readonly conditional: string[] = [];
  freeze?: { col: number; row: number };
  landscape = false;
  printArea?: string;
  printTitles?: string;
  tabColor = BRAND.indigo;
  selected = "A1";

  constructor(
    readonly book: Workbook,
    readonly name: string,
  ) {}

  width(col: string, width: number, toCol?: string): this {
    this.cols.push({ min: colNumber(col), max: colNumber(toCol ?? col), width });
    return this;
  }

  height(row: number, pt: number): this {
    this.heights.set(row, pt);
    return this;
  }

  private put(ref: string, cell: Cell): void {
    this.cells.set(ref, cell);
  }

  set(ref: string, value: string | number | null, style: XStyle = {}): this {
    const s = this.book.styles.style(style);
    if (value === null || value === "") this.put(ref, { s, kind: "empty" });
    else if (typeof value === "number") this.put(ref, { s, kind: "number", value });
    else this.put(ref, { s, kind: "string", value });
    return this;
  }

  formula(ref: string, formula: string, style: XStyle = {}, cached?: string | number): this {
    this.put(ref, { s: this.book.styles.style(style), kind: "formula", formula: formula.replace(/^=/, ""), cached });
    return this;
  }

  /** Applies one style across a rectangular range (keeps any existing values). */
  styleRange(range: string, style: XStyle): this {
    const [a, b] = range.split(":");
    const from = parseRef(a);
    const to = parseRef(b ?? a);
    const s = this.book.styles.style(style);
    for (let r = from.row; r <= to.row; r++) {
      for (let c = from.col; c <= to.col; c++) {
        const ref = `${colLetter(c)}${r}`;
        const existing = this.cells.get(ref);
        if (existing) existing.s = s;
        else this.put(ref, { s, kind: "empty" });
      }
    }
    return this;
  }

  merge(range: string, value: string | number | null, style: XStyle = {}): this {
    this.styleRange(range, style);
    this.set(range.split(":")[0], value, style);
    this.merges.push(range);
    return this;
  }

  mergeFormula(range: string, formula: string, style: XStyle = {}, cached?: string | number): this {
    this.styleRange(range, style);
    this.formula(range.split(":")[0], formula, style, cached);
    this.merges.push(range);
    return this;
  }

  listValidation(sqref: string, source: string, prompt?: { title: string; text: string }): this {
    const p = prompt ? ` promptTitle="${esc(prompt.title)}" prompt="${esc(prompt.text)}"` : "";
    this.validations.push(
      `<dataValidation type="list" allowBlank="1" showInputMessage="${prompt ? 1 : 0}" showErrorMessage="1" errorStyle="warning" errorTitle="Choose from the list" error="Pick one of the options in the dropdown."${p} sqref="${sqref}"><formula1>${esc(source)}</formula1></dataValidation>`,
    );
    return this;
  }

  decimalValidation(sqref: string, min: number, max: number, message: string): this {
    this.validations.push(
      `<dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Check this value" error="${esc(message)}" sqref="${sqref}"><formula1>${min}</formula1><formula2>${max}</formula2></dataValidation>`,
    );
    return this;
  }

  equalsHighlight(sqref: string, text: string, style: { color: string; fill: string; bold?: boolean }): this {
    const dxf = this.book.styles.dxf(style);
    const priority = this.book.nextPriority();
    this.conditional.push(
      `<conditionalFormatting sqref="${sqref}"><cfRule type="cellIs" dxfId="${dxf}" priority="${priority}" operator="equal"><formula>"${esc(text)}"</formula></cfRule></conditionalFormatting>`,
    );
    return this;
  }

  dataBar(sqref: string, color: string): this {
    const priority = this.book.nextPriority();
    this.conditional.push(
      `<conditionalFormatting sqref="${sqref}"><cfRule type="dataBar" priority="${priority}"><dataBar><cfvo type="num" val="0"/><cfvo type="num" val="1"/><color rgb="FF${color}"/></dataBar></cfRule></conditionalFormatting>`,
    );
    return this;
  }

  xml(sst: SharedStrings): string {
    const refs = [...this.cells.keys()].map((ref) => ({ ref, ...parseRef(ref) }));
    refs.sort((a, b) => a.row - b.row || a.col - b.col);
    const maxRow = Math.max(1, ...refs.map((r) => r.row));
    const maxCol = Math.max(1, ...refs.map((r) => r.col));
    const byRow = new Map<number, typeof refs>();
    for (const r of refs) {
      if (!byRow.has(r.row)) byRow.set(r.row, []);
      byRow.get(r.row)!.push(r);
    }
    const rowNums = [...new Set([...byRow.keys(), ...this.heights.keys()])].sort((a, b) => a - b);
    const rows = rowNums
      .map((rn) => {
        const cells = (byRow.get(rn) ?? [])
          .map(({ ref }) => {
            const c = this.cells.get(ref)!;
            switch (c.kind) {
              case "empty":
                return `<c r="${ref}" s="${c.s}"/>`;
              case "number":
                return `<c r="${ref}" s="${c.s}"><v>${c.value}</v></c>`;
              case "string":
                return `<c r="${ref}" s="${c.s}" t="s"><v>${sst.index(String(c.value))}</v></c>`;
              case "formula": {
                const f = `<f>${esc(c.formula!)}</f>`;
                if (c.cached === undefined) return `<c r="${ref}" s="${c.s}">${f}</c>`;
                if (typeof c.cached === "number") return `<c r="${ref}" s="${c.s}">${f}<v>${c.cached}</v></c>`;
                return `<c r="${ref}" s="${c.s}" t="str">${f}<v>${esc(c.cached)}</v></c>`;
              }
            }
          })
          .join("");
        const ht = this.heights.get(rn);
        return `<row r="${rn}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells}</row>`;
      })
      .join("");

    let pane = "";
    if (this.freeze) {
      const { col, row } = this.freeze;
      const top = `${colLetter(col + 1)}${row + 1}`;
      const active = col && row ? "bottomRight" : row ? "bottomLeft" : "topRight";
      pane =
        `<pane${col ? ` xSplit="${col}"` : ""}${row ? ` ySplit="${row}"` : ""} topLeftCell="${top}" activePane="${active}" state="frozen"/>` +
        `<selection pane="${active}" activeCell="${top}" sqref="${top}"/>`;
    } else {
      pane = `<selection activeCell="${this.selected}" sqref="${this.selected}"/>`;
    }
    const isFirst = this.book.sheets[0] === this;
    const cols = this.cols.length
      ? `<cols>${[...this.cols]
          .sort((a, b) => a.min - b.min)
          .map((c) => `<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`)
          .join("")}</cols>`
      : "";
    return (
      XML_HEAD +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheetPr><tabColor rgb="FF${this.tabColor}"/><pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<dimension ref="A1:${colLetter(maxCol)}${maxRow}"/>` +
      `<sheetViews><sheetView showGridLines="0"${isFirst ? ' tabSelected="1"' : ""} zoomScaleNormal="100" workbookViewId="0">${pane}</sheetView></sheetViews>` +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      cols +
      `<sheetData>${rows}</sheetData>` +
      (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
      this.conditional.join("") +
      (this.validations.length ? `<dataValidations count="${this.validations.length}">${this.validations.join("")}</dataValidations>` : "") +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      `<pageSetup paperSize="1" orientation="${this.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>` +
      `<headerFooter><oddFooter>${esc(`&L&8&K${BRAND.faint}${FOOTER_TEXT}&R&8&K${BRAND.faint}Page &P of &N`)}</oddFooter></headerFooter>` +
      "</worksheet>"
    );
  }
}

class SharedStrings {
  private list: string[] = [];
  private map = new Map<string, number>();
  count = 0;

  index(s: string): number {
    this.count += 1;
    const hit = this.map.get(s);
    if (hit !== undefined) return hit;
    this.list.push(s);
    this.map.set(s, this.list.length - 1);
    return this.list.length - 1;
  }

  xml(): string {
    return (
      XML_HEAD +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.count}" uniqueCount="${this.list.length}">` +
      this.list.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("") +
      "</sst>"
    );
  }
}

export class Workbook {
  readonly styles = new StyleTable();
  readonly sheets: Sheet[] = [];
  private priority = 0;

  nextPriority(): number {
    this.priority += 1;
    return this.priority;
  }

  sheet(name: string): Sheet {
    const s = new Sheet(this, name);
    this.sheets.push(s);
    return s;
  }

  async build(meta: { title: string; subject: string; description: string; keywords: string[] }): Promise<Uint8Array> {
    const sst = new SharedStrings();
    const sheetXml = this.sheets.map((s) => s.xml(sst));
    const quoted = (name: string) => `'${name.replace(/'/g, "''")}'`;
    const defined: string[] = [];
    this.sheets.forEach((s, i) => {
      if (s.printTitles) defined.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${esc(`${quoted(s.name)}!${s.printTitles}`)}</definedName>`);
      if (s.printArea) defined.push(`<definedName name="_xlnm.Print_Area" localSheetId="${i}">${esc(`${quoted(s.name)}!${s.printArea}`)}</definedName>`);
    });
    const workbook =
      XML_HEAD +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<workbookPr defaultThemeVersion="164011"/>' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="17000" activeTab="0"/></bookViews>' +
      `<sheets>${this.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
      (defined.length ? `<definedNames>${defined.join("")}</definedNames>` : "") +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      "</workbook>";
    const n = this.sheets.length;
    const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const wbRels =
      XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      this.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${n + 1}" Type="${REL}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId${n + 2}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>` +
      "</Relationships>";
    const contentTypes =
      XML_HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      this.sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      "</Types>";
    const rootRels =
      XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
      "</Relationships>";

    return zipParts([
      ["[Content_Types].xml", contentTypes],
      ["_rels/.rels", rootRels],
      ["docProps/core.xml", corePropsXml(meta)],
      ["docProps/app.xml", appPropsXml("Microsoft Excel", meta.title)],
      ["xl/workbook.xml", workbook],
      ["xl/_rels/workbook.xml.rels", wbRels],
      ["xl/styles.xml", this.styles.xml()],
      ...sheetXml.map((xml, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
      ["xl/sharedStrings.xml", sst.xml()],
    ]);
  }
}

/* ------------------------------------------------------------------ */
/* Shared spreadsheet styles                                           */
/* ------------------------------------------------------------------ */

const thin = (color: string = BRAND.line) => ({ color, style: "thin" as const });

export const CURRENCY = "$#,##0.00";
export const CURRENCY_DASH = '$#,##0.00;-$#,##0.00;"–"';
export const DATE = "mmm d, yyyy";

export const XS = {
  title: { font: { bold: true, size: 18, color: BRAND.slate } },
  subtitle: { font: { size: 10, color: BRAND.muted }, wrap: true, v: "top" },
  eyebrow: { font: { bold: true, size: 9, color: BRAND.indigo } },
  section: { font: { bold: true, size: 12, color: BRAND.slate }, border: { bottom: thin(BRAND.indigo) }, v: "bottom" },
  sectionRule: { border: { bottom: thin(BRAND.indigo) } },
  hint: { font: { size: 9, color: BRAND.muted }, wrap: true, v: "top" },
  head: { font: { bold: true, size: 9, color: BRAND.text }, fill: BRAND.bgIndigo, border: { bottom: thin(BRAND.indigoSoft) }, indent: 1 },
  headRight: { font: { bold: true, size: 9, color: BRAND.text }, fill: BRAND.bgIndigo, border: { bottom: thin(BRAND.indigoSoft) }, h: "right", indent: 1 },
  headCenter: { font: { bold: true, size: 9, color: BRAND.text }, fill: BRAND.bgIndigo, border: { bottom: thin(BRAND.indigoSoft) }, h: "center" },
  label: { font: { size: 10, color: BRAND.text }, border: { bottom: thin() }, indent: 1 },
  labelBold: { font: { bold: true, size: 10, color: BRAND.slate }, border: { bottom: thin() }, indent: 1 },
  note: { font: { size: 9, color: BRAND.muted }, border: { bottom: thin() }, wrap: true, indent: 1 },
  footer: { font: { size: 8, color: BRAND.faint } },
} satisfies Record<string, XStyle>;

/** Editable input cell: soft indigo fill, unlocked, with an optional number format. */
export function input(extra: Partial<XStyle> = {}): XStyle {
  return {
    font: { size: 10, color: BRAND.slate },
    fill: BRAND.bgIndigo,
    border: { bottom: thin(BRAND.indigoSoft), top: thin(BRAND.white), left: thin(BRAND.white), right: thin(BRAND.white) },
    unlocked: true,
    indent: 1,
    ...extra,
  };
}

/** Calculated cell: white with a hairline. */
export function calc(extra: Partial<XStyle> = {}): XStyle {
  return { font: { size: 10, color: BRAND.slate }, border: { bottom: thin() }, h: "right", indent: 1, ...extra };
}

export function emphasis(extra: Partial<XStyle> = {}): XStyle {
  return {
    font: { bold: true, size: 11, color: BRAND.indigoDark },
    fill: BRAND.bgIndigo,
    border: { top: thin(BRAND.indigo), bottom: thin(BRAND.indigo) },
    h: "right",
    indent: 1,
    ...extra,
  };
}
