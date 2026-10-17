import type { InventoryPage, PageKind } from "@/lib/seo-growth/inventory";

/**
 * Content gap backlog (System 3) and original-research roadmap. Every entry here is
 * RESEARCH-BASED: public search results and product verification, not measured search
 * demand. No search volumes or difficulty scores exist in this codebase; none are claimed.
 *
 * Rules applied: one distinct search intent per proposal; prefer improving an existing page;
 * only reference ShootPortal capabilities verified in code (file noted in `productFit`).
 */

export type GapAction =
  | "improve-article"
  | "improve-landing"
  | "add-section"
  | "expand-tool"
  | "new-resource"
  | "new-article"
  | "new-landing";

export const GAP_ACTION_LABELS: Record<GapAction, string> = {
  "improve-article": "Improve an existing article",
  "improve-landing": "Improve an existing landing page",
  "add-section": "Add a section to an existing page",
  "expand-tool": "Expand an existing calculator",
  "new-resource": "Create a new resource",
  "new-article": "Create a distinct new article",
  "new-landing": "Create a distinct new landing page",
};

export type ContentGap = {
  id: string;
  topic: string;
  /** The searcher's goal, in one line. */
  intent: string;
  audience: string;
  action: GapAction;
  /** Existing page to improve, or the closest existing page for new content. */
  target: string;
  why: string;
  /** What ShootPortal can say that generic results can't, with the code that proves it. */
  productFit: string;
  evidence: string[];
  checkedAt: string;
  effort: "low" | "medium" | "high";
  confidence: "medium" | "low";
  businessRelevance: "high" | "medium" | "low";
};

export const CONTENT_GAPS: readonly ContentGap[] = [
  {
    id: "gap-travel-fee-calculator",
    topic: "A client-facing travel fee policy (free radius, tiers, per mile)",
    intent: "Turn travel costs into a simple travel fee policy clients see on a quote: a free radius, then distance tiers or a per-mile rate.",
    audience: "Real estate photographers and drone pilots who drive to every job",
    action: "expand-tool",
    target: "/tools/real-estate-photography-pricing-calculator",
    why: "Travel pricing is a recurring question, and results are mostly forum threads and individual photographers' FAQ pages rather than a dedicated tool.",
    productFit:
      "ShootPortal already prices travel two ways, distance tiers or a free radius plus per-mile round trip (src/lib/travel-fee.ts), so a calculator step can mirror exactly how the product quotes it.",
    evidence: [
      "Web search (2026-10-16) for photographer travel fee per mile: top results are photographyforrealestate.net forum posts, individual photographer pages, and one general calculator site.",
      "Both calculators already include round-trip miles and drive time as a cost inside the job price (src/lib/tools/pricing-math.ts). Neither outputs a separate, client-facing travel fee schedule.",
      "13 articles mention travel fees; none offers a tool to build the schedule itself.",
    ],
    checkedAt: "2026-10-16",
    effort: "medium",
    confidence: "medium",
    businessRelevance: "high",
  },
  {
    id: "gap-drone-mapping-delivery",
    topic: "Delivering drone mapping and 3D model results to clients",
    intent: "Share orthomosaics, 3D models, and inspection results with a non-technical client in a professional way.",
    audience: "Drone pilots doing mapping, inspection, roofing, and construction progress work",
    action: "new-article",
    target: "/drone-business-management-software",
    why: "This is a distinct problem from photo or video delivery, and current answers are scattered across forums, vendor docs, and service listings.",
    productFit:
      "Projects can embed external 3D/mapping viewers from Matterport, Polycam, Pix4D, Agisoft, Sketchfab, and DroneDeploy (src/lib/external-3d-models.ts) next to photos, video, and the invoice.",
    evidence: [
      "Web search (2026-10-16) for delivering drone orthomosaic and 3D models to clients: results are MavicPilots and Pix4D community threads, Fiverr listings, and service-provider pages.",
      "No existing ShootPortal article covers mapping or 3D-model deliverables; the drone landing page focuses on photo/video jobs.",
    ],
    checkedAt: "2026-10-16",
    effort: "medium",
    confidence: "medium",
    businessRelevance: "medium",
  },
  {
    id: "gap-dronedesk-alternatives",
    topic: "Dronedesk alternatives",
    intent: "Compare client-side business tools for a drone services company before choosing one.",
    audience: "Commercial drone pilots evaluating software",
    action: "new-article",
    target: "/blog/best-drone-business-management-software",
    why: "Competitor-alternative searches carry high purchase intent, and Aryeo and HDPhotoHub already have dedicated alternatives articles. Dronedesk is the main client-side drone tool per the keyword map.",
    productFit: "Must stay fair: Dronedesk covers flight operations that ShootPortal does not (no flight logs, LAANC, or fleet). Position ShootPortal only for the client side.",
    evidence: [
      "Dronedesk publishes its own \"alternative to\" pages for other drone tools (blog.dronedesk.io), showing this query pattern is actively targeted in the niche.",
      "docs/SEO-KEYWORD-MAP.md: Dronedesk is the main client-side tool in drone business management results. It's mentioned in only 1 ShootPortal article.",
    ],
    checkedAt: "2026-10-16",
    effort: "high",
    confidence: "low",
    businessRelevance: "high",
  },
  {
    id: "gap-agent-outreach-templates",
    topic: "Outreach email templates for real estate photographers",
    intent: "Copy a proven first email or follow-up to pitch listing agents.",
    audience: "New and growing real estate photographers",
    action: "new-resource",
    target: "/blog/how-to-get-real-estate-photography-clients",
    why: "Template intent is distinct from the how-to article and fits the existing resource library format (free download, no signup).",
    productFit: "Pairs with the client and agent records in ShootPortal's CRM and the request link agents use to book.",
    evidence: [
      "The client-acquisition article explains outreach but has no copy-ready templates, and the resource library has no acquisition templates (src/lib/resources/registry.ts).",
    ],
    checkedAt: "2026-10-16",
    effort: "low",
    confidence: "medium",
    businessRelevance: "medium",
  },
  {
    id: "gap-mls-photo-size",
    topic: "MLS photo size and download formats",
    intent: "Know what size to export listing photos at and how to give agents both MLS and full-resolution files.",
    audience: "Real estate photographers",
    action: "add-section",
    target: "/blog/how-to-deliver-real-estate-photos",
    why: "A focused, scannable answer helps readers who arrive with this narrower question. A section on the existing delivery guide serves it without a thin new page.",
    productFit: "Clients choose MLS (2048px long edge) or Print (original) downloads (src/lib/download-quality.ts). Requirements vary by MLS, so don't publish per-MLS limits without sources.",
    evidence: ["MLS is mentioned in 20 articles but no section gives one clear answer on export size and dual-format delivery."],
    checkedAt: "2026-10-16",
    effort: "low",
    confidence: "medium",
    businessRelevance: "medium",
  },
  {
    id: "gap-spiro-alternatives",
    topic: "Spiro alternatives for real estate media businesses",
    intent: "Compare Spiro with other real estate media platforms.",
    audience: "Real estate photographers using or evaluating Spiro",
    action: "new-article",
    target: "/blog/shootportal-vs-aryeo-vs-hdphotohub",
    why: "Spiro is an active real estate media platform that some businesses moved to from Aryeo. Wait for indexing of the existing comparison cluster before adding another comparison.",
    productFit: "Verify Spiro's current features and pricing on spiro.media before writing; none are assumed here.",
    evidence: [
      "Spiro runs an active podcast on managing real estate photo/video businesses (spiromedia.podbean.com).",
      "A 2025 post by Berridge Media describes switching from Aryeo to Spiro (berridgemedia.zenfolio.com).",
      "spiro.media is linked from 5 ShootPortal comparison articles and currently redirects (308).",
    ],
    checkedAt: "2026-10-16",
    effort: "high",
    confidence: "low",
    businessRelevance: "medium",
  },
];

/** Considered and deliberately not recommended, so they aren't re-proposed. */
export const NOT_PURSUED: readonly { topic: string; reason: string }[] = [
  {
    topic: "Photography contract templates",
    reason: "ShootPortal has no contracts or e-signature (docs/SEO-KEYWORD-MAP.md). A template would attract visitors the product can't serve.",
  },
  {
    topic: "City or state pages (\"real estate photography software in Texas\")",
    reason: "Doorway pages: the same product page with a different place name adds no new value.",
  },
  {
    topic: "More \"best X software\" variants (e.g. for each niche)",
    reason: "The comparison cluster already covers these intents. More variants would compete with existing articles before any are indexed.",
  },
  {
    topic: "Flight logging, LAANC, or fleet management content",
    reason: "Outside the product. The drone page explicitly says it isn't flight-ops software.",
  },
];

export type ResearchIdea = {
  id: string;
  title: string;
  question: string;
  method: string;
  ethics: string;
  output: string;
  dependsOn: string;
};

/**
 * Original research ShootPortal could publish (System 12). Nothing here is collected yet;
 * no results, benchmarks, or survey numbers exist. Each idea names an ethical method.
 */
export const RESEARCH_IDEAS: readonly ResearchIdea[] = [
  {
    id: "research-pricing-survey",
    title: "Real estate & drone photography pricing survey",
    question: "What do working photographers and drone pilots actually charge per package, per square-foot tier, and for travel?",
    method: "Opt-in survey promoted to the newsletter, partner program, and communities; publish only aggregated ranges with the sample size and collection dates.",
    ethics: "Explicit consent on the form, no personal data in published results, and a minimum sample (e.g. 50 responses) before publishing any figure.",
    output: "Annual report with charts, methodology section, and downloadable data table, linked from both pricing guides and calculators.",
    dependsOn: "A survey form and an email list or partner channel to reach respondents.",
  },
  {
    id: "research-calculator-aggregates",
    title: "Aggregated calculator usage (future, opt-in only)",
    question: "Which package structures and add-ons do people configure most often?",
    method:
      "Today calculator inputs are NOT stored, and only interaction events (tool:<tool>:<action>) are tracked. A future version could add an explicit \"share my anonymized pricing for the annual report\" checkbox.",
    ethics: "Never collect inputs without that opt-in. Calculator users are not a representative sample of the market, so label any output as \"what calculator users entered\", not market prices.",
    output: "A methodology-first section inside the pricing survey report.",
    dependsOn: "Product decision plus consent copy. No schema change is proposed here.",
  },
  {
    id: "research-delivery-preferences",
    title: "How listing agents want media delivered",
    question: "Which formats, turnaround times, and delivery methods do agents prefer?",
    method: "Short opt-in survey distributed by participating photographers to their agents, plus 5–10 agent interviews.",
    ethics: "Respondents are anonymous. Report sample sizes and avoid implying national representativeness.",
    output: "Article with charts plus quotes (with permission), feeding the delivery guides and landing pages.",
    dependsOn: "Photographer partners willing to distribute the survey.",
  },
  {
    id: "research-founder-workflow",
    title: "Founder field notes: running a real estate media business",
    question: "What does the request-to-delivery workflow look like in a real business, with real (permissioned) numbers?",
    method: "First-hand case study from the founder's own media business: turnaround times, admin hours before and after, and payment timing.",
    ethics: "Use only the founder's own data, or clients' with written permission. Label it as one business's experience, not a benchmark.",
    output: "Case-study article with original screenshots and product demos, which strengthens experience signals on existing guides.",
    dependsOn: "Founder time and permission to share business data.",
  },
];

export type TopicCell = { cluster: string; pages: { path: string; title: string; kind: PageKind }[]; kinds: Partial<Record<PageKind, number>> };

/** Topic map: monitored content pages grouped by cluster, with a count per page type. */
export function topicMap(inventory: readonly InventoryPage[]): TopicCell[] {
  const map = new Map<string, TopicCell>();
  for (const p of inventory) {
    if (!["solution", "article", "tool", "resource"].includes(p.kind)) continue;
    const cell = map.get(p.cluster) ?? { cluster: p.cluster, pages: [], kinds: {} };
    cell.pages.push({ path: p.path, title: p.title, kind: p.kind });
    cell.kinds[p.kind] = (cell.kinds[p.kind] ?? 0) + 1;
    map.set(p.cluster, cell);
  }
  return [...map.values()].sort((a, b) => b.pages.length - a.pages.length);
}
