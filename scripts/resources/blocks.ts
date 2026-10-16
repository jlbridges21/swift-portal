/**
 * A small document model rendered to both PDF (pdf.ts) and DOCX (docx.ts),
 * so the printable and editable versions of a template never drift apart.
 */

export type Align = "left" | "right" | "center";

export type FieldItem = { label: string; value?: string; span?: number };

export type ChecklistItem = string | { text: string; hint?: string };

export type CheckGroup = { title: string; items: ChecklistItem[]; tag?: string };

export type Block =
  | {
      kind: "header";
      eyebrow: string;
      title: string;
      subtitle?: string;
      logoBox?: boolean;
      meta?: FieldItem[];
    }
  | { kind: "section"; title: string; number?: number; intro?: string; pageBreakBefore?: boolean }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "bullets"; items: string[] }
  | { kind: "fields"; columns: number; items: FieldItem[] }
  | { kind: "parties"; parties: Array<{ title: string; fields: string[] }> }
  | { kind: "prompt"; label?: string; guidance?: string; lines: number }
  | {
      kind: "table";
      columns: Array<{ header: string; width: number; align?: Align }>;
      rows?: string[][];
      blankRows?: number;
      rowHeight?: number;
      totals?: Array<{ label: string; value?: string; emphasis?: boolean; strong?: boolean }>;
      /** Fields shown to the left of the totals (PDF) or below them (DOCX). */
      aside?: { title: string; fields: string[] };
      note?: string;
    }
  | { kind: "checklist"; items: ChecklistItem[]; columns: 1 | 2 }
  | { kind: "checkGroups"; groups: CheckGroup[] }
  | {
      kind: "cards";
      cards: Array<{ title: string; subtitle?: string; price?: string; priceNote?: string; items: string[] }>;
    }
  | { kind: "note"; title?: string; text: string; tone?: "info" | "muted" }
  | { kind: "signature"; items: string[] }
  | { kind: "spacer"; size: number }
  | { kind: "pageBreak" };

export function itemText(item: ChecklistItem): { text: string; hint?: string } {
  return typeof item === "string" ? { text: item } : item;
}
