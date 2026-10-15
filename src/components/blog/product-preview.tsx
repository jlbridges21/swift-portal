import { DemoProjectsPanel } from "@/components/marketing/product-demo/demo-projects-panel";
import { DemoMediaPanel } from "@/components/marketing/product-demo/demo-media-panel";
import { DemoCalendarPanel } from "@/components/marketing/product-demo/demo-calendar-panel";
import { DemoMessagesPanel } from "@/components/marketing/product-demo/demo-messages-panel";
import { DemoClientsPanel } from "@/components/marketing/product-demo/demo-clients-panel";
import { InteractiveClientMockup } from "@/components/marketing/how-it-works/interactive-client-mockup";
import { InteractiveAdminMockup } from "@/components/marketing/how-it-works/interactive-admin-mockup";

export type ProductPreviewView = "projects" | "media" | "calendar" | "messages" | "clients" | "client-portal" | "studio";

const LABELS: Record<ProductPreviewView, string> = {
  projects: "Projects",
  media: "Media",
  calendar: "Calendar",
  messages: "Messages",
  clients: "Clients",
  "client-portal": "Client portal",
  studio: "Studio",
};

/**
 * Product views reused from the homepage product demo and /how-it-works
 * (fictional demo data, real pipeline stages). Rendered in a static state —
 * captions should call these "product illustrations", not screenshots.
 */
export function ProductPreview({ view }: { view: ProductPreviewView }) {
  if (view === "client-portal") return <InteractiveClientMockup />;
  if (view === "studio") return <InteractiveAdminMockup />;
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-50px_rgba(15,23,42,0.7)]" aria-hidden>
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
        ))}
        <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-[#64748B] ring-1 ring-[#E2E8F0]">ShootPortal · {LABELS[view]}</span>
      </div>
      <div className="h-[22rem] bg-[#F8FAFC] p-3 sm:h-[24rem] sm:p-4">
        {view === "projects" ? <DemoProjectsPanel highlightId="p4" /> : null}
        {view === "media" ? <DemoMediaPanel phase="select" /> : null}
        {view === "calendar" ? <DemoCalendarPanel phase="confirmed" /> : null}
        {view === "messages" ? <DemoMessagesPanel phase="read" /> : null}
        {view === "clients" ? <DemoClientsPanel highlightIndex={1} /> : null}
      </div>
    </div>
  );
}
