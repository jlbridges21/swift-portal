/**
 * Grouped deliverables inside an estimate / proposal description.
 *
 * A description stays plain, editable text. A line that starts with "## " opens
 * a service section; the lines under it (bullets, a "Starting at …" label,
 * notes) belong to that service until the next heading. Descriptions without a
 * "## " line are legacy single-service text and every renderer keeps drawing
 * them exactly as before.
 *
 * Pure module: used by the editor, the PDF builder (browser and server), the
 * client views and the request confirmation page.
 */

export const SECTION_HEADING_PREFIX = "## ";

/** Label shown in place of a price for a service with hidden or no pricing. */
export const CUSTOM_QUOTE_LABEL = "Custom Quote";

/**
 * Sentence written into the notes of a combined estimate when at least one
 * service is a custom quote. Its presence marks the total as partial everywhere
 * (card, PDF, confirmation page). Removing it from the notes is how a business
 * marks the estimate as complete.
 */
export const TOTAL_PENDING_NOTE =
  "The estimated total covers the priced services only. The full total is pending a custom quote.";

const TOTAL_PENDING_RE = /full total is pending/i;
const LABEL_RE = /^(starting at\b|from \$|custom quote\b|custom proposal\b|price to be confirmed\b)/i;
const BULLET_RE = /^[•\-–*]\s+/;

export type EstimateSection = {
  heading: string;
  /** "Starting at $249", "Custom Quote", … (first label line only). */
  label: string | null;
  includes: string[];
  /** Other lines (service description, per-service notes and disclaimers). */
  text: string[];
  /** Every line in its original order, for renderers that keep the layout as typed. */
  lines: { kind: "label" | "bullet" | "text"; text: string }[];
};

export type ParsedEstimateDescription = {
  intro: string;
  sections: EstimateSection[];
};

export function isSectionHeading(line: string): boolean {
  return line.trimStart().startsWith(SECTION_HEADING_PREFIX) && line.trim().length > SECTION_HEADING_PREFIX.trim().length;
}

export function hasEstimateSections(description: string | null | undefined): boolean {
  if (!description) return false;
  return description.split(/\r?\n/).some(isSectionHeading);
}

export function isEstimateLabelLine(line: string): boolean {
  return LABEL_RE.test(line.trim());
}

export function isBulletLine(line: string): boolean {
  return BULLET_RE.test(line.trim());
}

export function stripBullet(line: string): string {
  return line.trim().replace(BULLET_RE, "").trim();
}

export function sectionIsCustomQuote(section: EstimateSection): boolean {
  return Boolean(section.label && /^custom (quote|proposal)/i.test(section.label));
}

/** Returns sections only when the description has at least one "## " heading. */
export function parseEstimateDescription(description: string | null | undefined): ParsedEstimateDescription {
  const lines = (description ?? "").replace(/\r\n/g, "\n").split("\n");
  const introLines: string[] = [];
  const sections: EstimateSection[] = [];
  let current: EstimateSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (isSectionHeading(raw)) {
      current = {
        heading: line.slice(SECTION_HEADING_PREFIX.trim().length).trim(),
        label: null,
        includes: [],
        text: [],
        lines: [],
      };
      sections.push(current);
      continue;
    }
    if (!current) {
      introLines.push(raw);
      continue;
    }
    if (!line) continue;
    if (/^includes:?$/i.test(line)) continue;
    if (isBulletLine(line)) {
      current.includes.push(stripBullet(line));
      current.lines.push({ kind: "bullet", text: stripBullet(line) });
    } else if (!current.label && isEstimateLabelLine(line)) {
      current.label = line;
      current.lines.push({ kind: "label", text: line });
    } else {
      current.text.push(line);
      current.lines.push({ kind: "text", text: line });
    }
  }

  return { intro: introLines.join("\n").trim(), sections };
}

export function estimateTotalPending(notes: string | null | undefined): boolean {
  return TOTAL_PENDING_RE.test(notes ?? "");
}

/** Plain text for emails / one-line previews: headings lose their marker. */
export function descriptionAsPlainText(description: string | null | undefined): string {
  return (description ?? "")
    .split(/\r?\n/)
    .map((line) => (isSectionHeading(line) ? line.trim().slice(SECTION_HEADING_PREFIX.trim().length).trim() : line))
    .join("\n");
}

export type ServiceSectionInput = {
  heading: string;
  label: string | null;
  description?: string | null;
  includes: string[];
  notes?: string | null;
};

/** Serialize grouped deliverables (one block per service, blank line between). */
export function buildSectionedDescription(sections: ServiceSectionInput[], intro?: string | null): string {
  const blocks: string[] = [];
  if (intro?.trim()) blocks.push(intro.trim());
  for (const section of sections) {
    const lines = [`${SECTION_HEADING_PREFIX}${section.heading.trim()}`];
    if (section.label?.trim()) lines.push(section.label.trim());
    if (section.description?.trim()) lines.push(section.description.trim());
    for (const item of section.includes) {
      if (item.trim()) lines.push(`• ${item.trim()}`);
    }
    if (section.notes?.trim()) lines.push(section.notes.trim());
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}
