import { itemText, type Block, type ChecklistItem, type FieldItem } from "./blocks";
import { BRAND, FOOTER_TEXT, type DocMeta } from "./brand";
import { appPropsXml, corePropsXml, esc, XML_HEAD, zipParts } from "./ooxml";

/** US Letter with 0.75in margins: 10080 twips of content width, same as the PDFs. */
const CONTENT_W = 10080;
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const MC_NS = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const W14_NS = 'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';

/* ------------------------------------------------------------------ */
/* Primitive XML helpers                                               */
/* ------------------------------------------------------------------ */

type RunOpts = { bold?: boolean; italic?: boolean; color?: string; size?: number; font?: string };

function rPr(o: RunOpts): string {
  const p: string[] = [];
  if (o.font) p.push(`<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:eastAsia="${o.font}" w:cs="${o.font}"/>`);
  if (o.bold) p.push("<w:b/><w:bCs/>");
  if (o.italic) p.push("<w:i/><w:iCs/>");
  if (o.color) p.push(`<w:color w:val="${o.color}"/>`);
  if (o.size) p.push(`<w:sz w:val="${Math.round(o.size * 2)}"/><w:szCs w:val="${Math.round(o.size * 2)}"/>`);
  return p.length ? `<w:rPr>${p.join("")}</w:rPr>` : "";
}

function run(text: string, o: RunOpts = {}): string {
  const props = rPr(o);
  const pieces = text.split(/(\t|\n)/).filter((s) => s !== "");
  return pieces
    .map((piece) => {
      if (piece === "\t") return `<w:r>${props}<w:tab/></w:r>`;
      if (piece === "\n") return `<w:r>${props}<w:br/></w:r>`;
      return `<w:r>${props}<w:t xml:space="preserve">${esc(piece)}</w:t></w:r>`;
    })
    .join("");
}

type BorderSpec = { color: string; sz: number; val?: "single" | "dashed"; space?: number };

type ParaOpts = {
  style?: string;
  keepNext?: boolean;
  pageBreakBefore?: boolean;
  numId?: number;
  borderBottom?: BorderSpec;
  tabs?: Array<{ val: "left" | "right"; pos: number }>;
  before?: number;
  after?: number;
  line?: number;
  lineRule?: "auto" | "exact" | "atLeast";
  indLeft?: number;
  hanging?: number;
  align?: "left" | "center" | "right";
};

function para(content: string, o: ParaOpts = {}): string {
  const p: string[] = [];
  if (o.style) p.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) p.push("<w:keepNext/>");
  if (o.pageBreakBefore) p.push("<w:pageBreakBefore/>");
  if (o.numId) p.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`);
  if (o.borderBottom) {
    const b = o.borderBottom;
    p.push(`<w:pBdr><w:bottom w:val="${b.val ?? "single"}" w:sz="${b.sz}" w:space="${b.space ?? 1}" w:color="${b.color}"/></w:pBdr>`);
  }
  if (o.tabs?.length) p.push(`<w:tabs>${o.tabs.map((t) => `<w:tab w:val="${t.val}" w:pos="${t.pos}"/>`).join("")}</w:tabs>`);
  if (o.before !== undefined || o.after !== undefined || o.line !== undefined) {
    const attrs = [
      o.before !== undefined ? `w:before="${o.before}"` : "",
      o.after !== undefined ? `w:after="${o.after}"` : "",
      o.line !== undefined ? `w:line="${o.line}" w:lineRule="${o.lineRule ?? "auto"}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    p.push(`<w:spacing ${attrs}/>`);
  }
  if (o.indLeft !== undefined) p.push(`<w:ind w:left="${o.indLeft}"${o.hanging ? ` w:hanging="${o.hanging}"` : ""}/>`);
  if (o.align && o.align !== "left") p.push(`<w:jc w:val="${o.align}"/>`);
  return `<w:p>${p.length ? `<w:pPr>${p.join("")}</w:pPr>` : ""}${content}</w:p>`;
}

function spacer(twips: number): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.max(twips, 20)}" w:lineRule="exact"/></w:pPr></w:p>`;
}

type Edge = "top" | "left" | "bottom" | "right" | "insideH" | "insideV";
type Borders = Partial<Record<Edge, BorderSpec | null>>;

function bordersXml(tag: "tblBorders" | "tcBorders", b: Borders, edges: Edge[]): string {
  const inner = edges
    .map((edge) => {
      const spec = b[edge];
      if (!spec) return `<w:${edge} w:val="nil"/>`;
      return `<w:${edge} w:val="${spec.val ?? "single"}" w:sz="${spec.sz}" w:space="0" w:color="${spec.color}"/>`;
    })
    .join("");
  return `<w:${tag}>${inner}</w:${tag}>`;
}

type Mar = { top?: number; left?: number; bottom?: number; right?: number };

function marXml(tag: "tblCellMar" | "tcMar", m: Mar): string {
  const edges: Array<keyof Mar> = ["top", "left", "bottom", "right"];
  return `<w:${tag}>${edges
    .filter((e) => m[e] !== undefined)
    .map((e) => `<w:${e} w:w="${m[e]}" w:type="dxa"/>`)
    .join("")}</w:${tag}>`;
}

function tbl(o: { widths: number[]; rows: string[]; borders?: Borders; jc?: "left" | "right" | "center"; cellMar?: Mar }): string {
  const total = o.widths.reduce((s, w) => s + w, 0);
  const pr = [
    `<w:tblW w:w="${total}" w:type="dxa"/>`,
    o.jc ? `<w:jc w:val="${o.jc}"/>` : "",
    bordersXml("tblBorders", o.borders ?? {}, ["top", "left", "bottom", "right", "insideH", "insideV"]),
    '<w:tblLayout w:type="fixed"/>',
    marXml("tblCellMar", o.cellMar ?? { top: 0, left: 0, bottom: 0, right: 0 }),
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>',
  ].join("");
  const grid = o.widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  return `<w:tbl><w:tblPr>${pr}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${o.rows.join("")}</w:tbl>`;
}

function tr(cells: string[], o: { height?: number; rule?: "atLeast" | "exact"; header?: boolean; cantSplit?: boolean } = {}): string {
  const pr = [
    o.cantSplit ? "<w:cantSplit/>" : "",
    o.height ? `<w:trHeight w:val="${o.height}" w:hRule="${o.rule ?? "atLeast"}"/>` : "",
    o.header ? "<w:tblHeader/>" : "",
  ].join("");
  return `<w:tr>${pr ? `<w:trPr>${pr}</w:trPr>` : ""}${cells.join("")}</w:tr>`;
}

function tc(content: string, o: { w: number; span?: number; fill?: string; borders?: Borders; vAlign?: "top" | "center" | "bottom"; mar?: Mar }): string {
  const pr = [
    `<w:tcW w:w="${o.w}" w:type="dxa"/>`,
    o.span && o.span > 1 ? `<w:gridSpan w:val="${o.span}"/>` : "",
    o.borders ? bordersXml("tcBorders", o.borders, ["top", "left", "bottom", "right"]) : "",
    o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "",
    o.mar ? marXml("tcMar", o.mar) : "",
    o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : "",
  ].join("");
  const body = content.trim() ? content : "<w:p/>";
  // A cell must end with a paragraph.
  const safe = body.endsWith("</w:tbl>") ? `${body}<w:p/>` : body;
  return `<w:tc><w:tcPr>${pr}</w:tcPr>${safe}</w:tc>`;
}

const LINE: BorderSpec = { color: BRAND.line, sz: 6 };
const LINE_STRONG: BorderSpec = { color: BRAND.lineStrong, sz: 6 };
const ALL_LINE: Borders = { top: LINE, left: LINE, bottom: LINE, right: LINE };

/** Splits a width into n columns separated by gutters; returns grid widths [w, g, w, g, w…]. */
function gutterGrid(n: number, gutter: number, total = CONTENT_W): { grid: number[]; col: number } {
  const col = Math.floor((total - gutter * (n - 1)) / n);
  const grid: number[] = [];
  for (let i = 0; i < n; i++) {
    grid.push(col);
    if (i < n - 1) grid.push(gutter);
  }
  grid[grid.length - 1] += total - grid.reduce((s, w) => s + w, 0);
  return { grid, col };
}

/* ------------------------------------------------------------------ */
/* Block renderers                                                     */
/* ------------------------------------------------------------------ */

class DocxRenderer {
  private sdtId = 100;

  checkbox(): string {
    this.sdtId += 1;
    const font = '<w:rFonts w:ascii="MS Gothic" w:eastAsia="MS Gothic" w:hAnsi="MS Gothic" w:hint="eastAsia"/>';
    return (
      "<w:sdt><w:sdtPr>" +
      `<w:rPr>${font}<w:color w:val="${BRAND.muted}"/></w:rPr>` +
      `<w:id w:val="${this.sdtId}"/>` +
      '<w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox>' +
      "</w:sdtPr><w:sdtContent>" +
      `<w:r><w:rPr>${font}<w:color w:val="${BRAND.muted}"/></w:rPr><w:t>☐</w:t></w:r>` +
      "</w:sdtContent></w:sdt>"
    );
  }

  checkItem(raw: ChecklistItem): string {
    const item = itemText(raw);
    const hint = item.hint ? `<w:r><w:br/></w:r>${run(item.hint, { size: 8.5, color: BRAND.muted })}` : "";
    return para(`${this.checkbox()}${run("\t")}${run(item.text, { color: BRAND.ink })}${hint}`, {
      indLeft: 400,
      hanging: 400,
      tabs: [{ val: "left", pos: 400 }],
      after: 90,
    });
  }

  header(b: Extract<Block, { kind: "header" }>): string {
    const textParts =
      para(run(b.eyebrow), { style: "Eyebrow" }) +
      para(run(b.title), { style: "Title" }) +
      (b.subtitle ? para(run(b.subtitle), { style: "Subtitle" }) : "");
    let out: string;
    if (b.logoBox) {
      const logoW = 2600;
      const gap = 400;
      const leftW = CONTENT_W - logoW - gap;
      const dashed: BorderSpec = { color: BRAND.lineStrong, sz: 8, val: "dashed" };
      const logo = tbl({
        widths: [logoW],
        rows: [
          tr(
            [
              tc(para(run("Your logo", { size: 8.5, color: BRAND.faint }), { align: "center" }), {
                w: logoW,
                vAlign: "center",
                borders: { top: dashed, left: dashed, bottom: dashed, right: dashed },
              }),
            ],
            { height: 1160, rule: "exact" },
          ),
        ],
      });
      out = tbl({
        widths: [leftW, gap, logoW],
        rows: [tr([tc(textParts, { w: leftW, vAlign: "top" }), tc("", { w: gap }), tc(logo, { w: logoW, vAlign: "top" })])],
      });
    } else {
      out = textParts;
    }
    out += spacer(320);
    if (b.meta?.length) {
      const n = b.meta.length;
      const w = Math.floor(CONTENT_W / n);
      const widths = Array.from({ length: n }, (_, i) => (i === n - 1 ? CONTENT_W - w * (n - 1) : w));
      const cells = b.meta.map((m, i) =>
        tc(
          para(run(m.label), { style: "FieldLabel", before: 100 }) +
            para(m.value ? run(m.value, { bold: true, color: BRAND.slate }) : "", { after: 110, before: 20 }),
          { w: widths[i], fill: BRAND.bgLight },
        ),
      );
      out += tbl({
        widths,
        rows: [tr(cells)],
        borders: { ...ALL_LINE, insideV: LINE },
        cellMar: { left: 200, right: 200, top: 0, bottom: 0 },
      });
      out += spacer(200);
    }
    return out;
  }

  section(b: Extract<Block, { kind: "section" }>): string {
    const num = b.number !== undefined ? `${run(String(b.number).padStart(2, "0"), { color: BRAND.indigo })}${run("\t")}` : "";
    let out = para(`${num}${run(b.title)}`, {
      style: "Heading1",
      tabs: b.number !== undefined ? [{ val: "left", pos: 560 }] : undefined,
      pageBreakBefore: b.pageBreakBefore,
    });
    if (b.intro) out += para(run(b.intro), { style: "Guidance", keepNext: true });
    return out;
  }

  fieldCell(item: FieldItem, w: number, span: number): string {
    return tc(
      para(run(item.label), { style: "FieldLabel", keepNext: true }) +
        para(item.value ? run(item.value, { color: BRAND.slate }) : "", { style: "FieldValue" }),
      { w, span },
    );
  }

  fields(b: Extract<Block, { kind: "fields" }>): string {
    const gutter = 360;
    const { grid, col } = gutterGrid(b.columns, gutter);
    const rows: string[] = [];
    let cells: string[] = [];
    let used = 0;
    const flush = () => {
      if (used < b.columns && used > 0) {
        const rest = b.columns - used;
        cells.push(tc("", { w: rest * col + rest * gutter, span: rest * 2 }));
      }
      if (cells.length) rows.push(tr(cells, { cantSplit: true }));
      cells = [];
      used = 0;
    };
    for (const item of b.items) {
      const span = Math.min(item.span ?? 1, b.columns);
      if (used + span > b.columns) flush();
      if (used > 0) cells.push(tc("", { w: gutter }));
      const w = span * col + (span - 1) * gutter;
      cells.push(this.fieldCell(item, w, span * 2 - 1));
      used += span;
    }
    flush();
    return tbl({ widths: grid, rows }) + spacer(200);
  }

  parties(b: Extract<Block, { kind: "parties" }>): string {
    const gutter = 560;
    const { grid } = gutterGrid(b.parties.length, gutter);
    const cells: string[] = [];
    b.parties.forEach((party, i) => {
      if (i > 0) cells.push(tc("", { w: gutter }));
      const content =
        para(run(party.title), { style: "Eyebrow", after: 0 }) +
        party.fields.map((f) => para(run(f), { style: "FieldLabel", keepNext: true }) + para("", { style: "FieldValue" })).join("");
      cells.push(tc(content, { w: grid[i * 2] }));
    });
    return tbl({ widths: grid, rows: [tr(cells, { cantSplit: true })] }) + spacer(240);
  }

  prompt(b: Extract<Block, { kind: "prompt" }>): string {
    let out = "";
    if (b.label) out += para(run(b.label), { style: "Heading2" });
    if (b.guidance) out += para(run(b.guidance), { style: "Guidance", keepNext: true });
    const lines = Array.from({ length: b.lines }, () => para("", { line: 340, lineRule: "atLeast" })).join("");
    out += tbl({
      widths: [CONTENT_W],
      rows: [tr([tc(lines, { w: CONTENT_W, fill: BRAND.bgLight })])],
      borders: ALL_LINE,
      cellMar: { top: 100, left: 180, bottom: 100, right: 180 },
    });
    return out + spacer(200);
  }

  table(b: Extract<Block, { kind: "table" }>): string {
    const totalUnits = b.columns.reduce((s, c) => s + c.width, 0);
    const widths = b.columns.map((c) => Math.floor((c.width / totalUnits) * CONTENT_W));
    widths[widths.length - 1] += CONTENT_W - widths.reduce((s, w) => s + w, 0);
    const head = tr(
      b.columns.map((c, i) =>
        tc(para(run(c.header, { bold: true, color: BRAND.text, size: 8.5 }), { align: c.align }), {
          w: widths[i],
          fill: BRAND.bgIndigo,
          vAlign: "center",
        }),
      ),
      { header: true, height: 440, cantSplit: true },
    );
    const rows: string[][] = [...(b.rows ?? []), ...Array.from({ length: b.blankRows ?? 0 }, () => [])];
    const height = Math.round((b.rowHeight ?? 24) * 20);
    const body = rows.map((row) =>
      tr(
        b.columns.map((c, i) =>
          tc(
            para(row[i] ? run(row[i], { size: 9.5, color: i === 0 ? BRAND.ink : BRAND.body }) : "", { align: c.align }),
            { w: widths[i], vAlign: "center" },
          ),
        ),
        { height, cantSplit: true },
      ),
    );
    let out = tbl({
      widths,
      rows: [head, ...body],
      borders: { bottom: LINE, insideH: LINE },
      cellMar: { left: 160, right: 160, top: 60, bottom: 60 },
    });
    if (b.totals?.length) {
      out += spacer(160);
      const tw = [2760, 1880];
      out += tbl({
        widths: tw,
        jc: "right",
        rows: b.totals.map((t) =>
          tr(
            [
              tc(para(run(t.label, { bold: t.emphasis || t.strong, color: t.emphasis || t.strong ? BRAND.slate : BRAND.body, size: 9.5 })), {
                w: tw[0],
                fill: t.emphasis ? BRAND.bgIndigo : undefined,
                vAlign: "center",
              }),
              tc(para(t.value ? run(t.value, { bold: true, color: BRAND.slate, size: 9.5 }) : "", { align: "right" }), {
                w: tw[1],
                fill: t.emphasis ? BRAND.bgIndigo : undefined,
                vAlign: "center",
              }),
            ],
            { height: 420, cantSplit: true },
          ),
        ),
        borders: { insideH: LINE, bottom: LINE },
        cellMar: { left: 160, right: 160, top: 40, bottom: 40 },
      });
    }
    if (b.aside) out += spacer(200) + this.parties({ kind: "parties", parties: [{ title: b.aside.title, fields: b.aside.fields }] });
    if (b.note) out += spacer(100) + para(run(b.note), { style: "Guidance" });
    return out + spacer(200);
  }

  checklist(b: Extract<Block, { kind: "checklist" }>): string {
    if (b.columns === 1) return b.items.map((i) => this.checkItem(i)).join("") + spacer(120);
    const half = Math.ceil(b.items.length / 2);
    const { grid } = gutterGrid(2, 360);
    const col = (items: ChecklistItem[], w: number) => tc(items.map((i) => this.checkItem(i)).join(""), { w });
    return (
      tbl({
        widths: grid,
        rows: [tr([col(b.items.slice(0, half), grid[0]), tc("", { w: grid[1] }), col(b.items.slice(half), grid[2])])],
      }) + spacer(160)
    );
  }

  checkGroups(b: Extract<Block, { kind: "checkGroups" }>): string {
    const { grid } = gutterGrid(2, 280);
    const rows: string[] = [];
    for (let i = 0; i < b.groups.length; i += 2) {
      if (i > 0) rows.push(tr([tc("", { w: grid[0] }), tc("", { w: grid[1] }), tc("", { w: grid[2] })], { height: 220, rule: "exact" }));
      const cell = (j: number) => {
        const g = b.groups[i + j];
        if (!g) return tc("", { w: grid[j * 2] });
        const tag = g.tag ? run(`   ${g.tag}`, { bold: true, size: 7.5, color: BRAND.indigo }) : "";
        const content =
          para(run(g.title, { bold: true, size: 10.5, color: BRAND.slate }) + tag, { after: 120, keepNext: true }) +
          g.items.map((it) => this.checkItem(it)).join("");
        return tc(content, { w: grid[j * 2], borders: ALL_LINE, mar: { top: 180, left: 220, bottom: 100, right: 200 } });
      };
      rows.push(tr([cell(0), tc("", { w: grid[1] }), cell(1)], { cantSplit: true }));
    }
    return tbl({ widths: grid, rows }) + spacer(200);
  }

  cards(b: Extract<Block, { kind: "cards" }>): string {
    const { grid } = gutterGrid(b.cards.length, 240);
    const cells: string[] = [];
    b.cards.forEach((card, i) => {
      if (i > 0) cells.push(tc("", { w: 240 }));
      const content =
        para(run(card.title, { bold: true, size: 13, color: BRAND.slate }), { after: 40 }) +
        (card.subtitle ? para(run(card.subtitle, { size: 8.5, color: BRAND.muted }), { after: 160 }) : "") +
        para(run(card.price ?? "$", { bold: true, size: 16, color: BRAND.slate }), { after: 160 }) +
        card.items.map((it) => para(run(it, { size: 9 }), { numId: 1, after: 60 })).join("");
      cells.push(tc(content, { w: grid[i * 2], borders: ALL_LINE, mar: { top: 220, left: 220, bottom: 220, right: 220 } }));
    });
    return tbl({ widths: grid, rows: [tr(cells, { cantSplit: true })] }) + spacer(200);
  }

  note(b: Extract<Block, { kind: "note" }>): string {
    const content =
      (b.title ? para(run(b.title, { bold: true, size: 9, color: BRAND.slate }), { after: 40 }) : "") +
      para(run(b.text, { size: 9 }));
    return (
      tbl({
        widths: [CONTENT_W],
        rows: [tr([tc(content, { w: CONTENT_W, fill: b.tone === "muted" ? BRAND.bgLight : BRAND.bgIndigo })], { cantSplit: true })],
        cellMar: { top: 180, left: 240, bottom: 180, right: 240 },
      }) + spacer(240)
    );
  }

  signature(b: Extract<Block, { kind: "signature" }>): string {
    const gutter = 480;
    const { grid } = gutterGrid(b.items.length, gutter);
    const lineRow: string[] = [];
    const labelRow: string[] = [];
    b.items.forEach((label, i) => {
      if (i > 0) {
        lineRow.push(tc("", { w: gutter }));
        labelRow.push(tc("", { w: gutter }));
      }
      lineRow.push(tc("", { w: grid[i * 2], borders: { bottom: { color: BRAND.lineStrong, sz: 8 } }, vAlign: "bottom" }));
      labelRow.push(tc(para(run(label), { style: "FieldLabel", before: 60 }), { w: grid[i * 2] }));
    });
    return tbl({ widths: grid, rows: [tr(lineRow, { height: 760, cantSplit: true }), tr(labelRow)] }) + spacer(200);
  }

  render(blocks: Block[]): string {
    return blocks
      .map((b) => {
        switch (b.kind) {
          case "header":
            return this.header(b);
          case "section":
            return this.section(b);
          case "paragraph":
            return para(run(b.text, b.muted ? { size: 8.5, color: BRAND.muted } : {}), { after: 120 });
          case "bullets":
            return b.items.map((it) => para(run(it), { numId: 1, after: 60 })).join("") + spacer(120);
          case "fields":
            return this.fields(b);
          case "parties":
            return this.parties(b);
          case "prompt":
            return this.prompt(b);
          case "table":
            return this.table(b);
          case "checklist":
            return this.checklist(b);
          case "checkGroups":
            return this.checkGroups(b);
          case "cards":
            return this.cards(b);
          case "note":
            return this.note(b);
          case "signature":
            return this.signature(b);
          case "spacer":
            return spacer(b.size * 20);
          case "pageBreak":
            return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        }
      })
      .join("");
  }
}

/* ------------------------------------------------------------------ */
/* Package parts                                                       */
/* ------------------------------------------------------------------ */

function stylesXml(): string {
  const B = BRAND;
  return (
    XML_HEAD +
    `<w:styles ${W_NS} ${MC_NS} ${W14_NS} mc:Ignorable="w14">` +
    "<w:docDefaults>" +
    `<w:rPrDefault><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:eastAsia="Inter" w:cs="Arial"/><w:color w:val="${B.body}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    "</w:docDefaults>" +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="100" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${B.slate}"/><w:kern w:val="28"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="290" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="${B.body}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Eyebrow"><w:name w:val="Eyebrow"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${B.indigo}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="${B.line}"/></w:pBdr><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${B.slate}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="160" w:after="40"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${B.slate}"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Guidance"><w:name w:val="Guidance"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="100" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="${B.muted}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="FieldLabel"><w:name w:val="Field label"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="140" w:after="20"/></w:pPr><w:rPr><w:color w:val="${B.muted}"/><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="FieldValue"><w:name w:val="Field value"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="${B.lineStrong}"/></w:pBdr><w:spacing w:before="40" w:after="40" w:line="300" w:lineRule="atLeast"/></w:pPr><w:rPr><w:color w:val="${B.slate}"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs></w:pPr><w:rPr><w:color w:val="${B.faint}"/><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:style>` +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    "</w:styles>"
  );
}

function numberingXml(): string {
  return (
    XML_HEAD +
    `<w:numbering ${W_NS}>` +
    '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>' +
    `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="320" w:hanging="220"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="${BRAND.indigo}"/></w:rPr></w:lvl>` +
    "</w:abstractNum>" +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    "</w:numbering>"
  );
}

function fontTableXml(): string {
  return (
    XML_HEAD +
    `<w:fonts ${W_NS}>` +
    '<w:font w:name="Inter"><w:altName w:val="Arial"/><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>' +
    '<w:font w:name="Arial"><w:panose1 w:val="020B0604020202020204"/><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>' +
    '<w:font w:name="MS Gothic"><w:charset w:val="80"/><w:family w:val="modern"/><w:pitch w:val="fixed"/></w:font>' +
    "</w:fonts>"
  );
}

function settingsXml(): string {
  return (
    XML_HEAD +
    `<w:settings ${W_NS}>` +
    '<w:zoom w:percent="100"/>' +
    '<w:defaultTabStop w:val="720"/>' +
    '<w:characterSpacingControl w:val="doNotCompress"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    "</w:settings>"
  );
}

function footerXml(): string {
  return (
    XML_HEAD +
    `<w:ftr ${W_NS} ${R_NS}>` +
    `<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${run(FOOTER_TEXT)}${run("\t")}${run("Page ")}<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>` +
    "</w:ftr>"
  );
}

export async function renderDocx(meta: DocMeta, blocks: Block[]): Promise<Uint8Array> {
  const body = new DocxRenderer().render(blocks);
  const document =
    XML_HEAD +
    `<w:document ${W_NS} ${R_NS} ${MC_NS} ${W14_NS} mc:Ignorable="w14"><w:body>` +
    body +
    "<w:p/>" +
    '<w:sectPr><w:footerReference w:type="default" r:id="rId6"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="1080" w:bottom="1000" w:left="1080" w:header="560" w:footer="520" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>' +
    "</w:body></w:document>";

  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const contentTypes =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    "</Types>";
  const rootRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
    "</Relationships>";
  const docRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/settings" Target="settings.xml"/>` +
    `<Relationship Id="rId3" Type="${REL}/fontTable" Target="fontTable.xml"/>` +
    `<Relationship Id="rId4" Type="${REL}/numbering" Target="numbering.xml"/>` +
    `<Relationship Id="rId6" Type="${REL}/footer" Target="footer1.xml"/>` +
    "</Relationships>";

  return zipParts([
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRels],
    ["docProps/core.xml", corePropsXml(meta)],
    ["docProps/app.xml", appPropsXml("Microsoft Office Word", meta.title)],
    ["word/document.xml", document],
    ["word/_rels/document.xml.rels", docRels],
    ["word/styles.xml", stylesXml()],
    ["word/settings.xml", settingsXml()],
    ["word/fontTable.xml", fontTableXml()],
    ["word/numbering.xml", numberingXml()],
    ["word/footer1.xml", footerXml()],
  ]);
}
