/**
 * SEO changes made in code. Shown on the Roadmap as "done in code" so the dashboard can say
 * which recommendations are already handled. Live-site checks only reflect them after deploy
 * and the next refresh. Add an entry whenever a growth-engine recommendation is implemented.
 */

export type SeoChange = { date: string; title: string; pages: string[]; detail: string };

export const SEO_CHANGES: readonly SeoChange[] = [
  {
    date: "2026-10-16",
    title: "Replaced a broken source link",
    pages: ["/blog/best-photography-client-portals"],
    detail:
      "Moxie's help article (help.withmoxie.com/…/5855650) returns 404. The citation now points to Moxie's client portal page, and the sentence was narrowed to what that page says (no shared passwords).",
  },
  {
    date: "2026-10-16",
    title: "Linked four articles to the calculator they're paired with",
    pages: [
      "/blog/best-drone-business-management-software",
      "/blog/best-photography-crm-software",
      "/blog/get-paid-before-delivering-real-estate-photos",
      "/blog/best-photography-invoicing-software",
    ],
    detail: "Added a free-tool callout in the section where the reader is pricing or quoting (drone calculator, quote builder ×2, real estate calculator), matching the tools registry.",
  },
  {
    date: "2026-10-16",
    title: "Added in-content links to three under-linked landing pages",
    pages: ["/photography-booking-software", "/video-review-approval-software", "/photography-business-management-software"],
    detail:
      "New descriptive links from photography-workflow-automation (booking), how-to-send-large-video-files-to-clients and best-photo-video-delivery-platforms (video review), and how-to-start-drone-photography-business (business management).",
  },
  {
    date: "2026-10-16",
    title: "Linked the /tools hub from page content",
    pages: ["/tools", "/resources"],
    detail: "The /resources hub's \"Need the numbers first?\" section now links to /tools. Previously only the header and footer did.",
  },
];
