import Image from "next/image";

export type ProductPreviewView = "projects" | "media" | "calendar" | "messages" | "clients" | "client-portal" | "studio";

const VIEWS: Record<ProductPreviewView, { label: string; url: string; alt: string }> = {
  projects: {
    label: "Projects",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal project pipeline with listing shoots in New Request, Quote Sent, Proposal Approved, Scheduled and Shoot Complete",
  },
  media: {
    label: "Media",
    url: "coastallight.shootportal.app/admin/media",
    alt: "ShootPortal media library with listing photos and aerials from every project",
  },
  calendar: {
    label: "Calendar",
    url: "coastallight.shootportal.app/admin/calendar",
    alt: "ShootPortal shoot calendar for November with confirmed listing shoots",
  },
  messages: {
    label: "Messages",
    url: "coastallight.shootportal.app/admin/messages",
    alt: "ShootPortal client messages with the project timeline beside the conversation",
  },
  clients: {
    label: "Clients",
    url: "coastallight.shootportal.app/admin/clients",
    alt: "ShootPortal client list with agents, companies, portal status and project counts",
  },
  "client-portal": {
    label: "Client portal",
    url: "coastallight.shootportal.app",
    alt: "A branded client portal showing a finished listing: Download All, photo gallery and project status",
  },
  studio: {
    label: "Command Center",
    url: "coastallight.shootportal.app/admin",
    alt: "ShootPortal Command Center with revenue, projects by stage, upcoming shoots and recent messages",
  },
};

/**
 * A real ShootPortal screen (captured from a demo business with sample clients and fictional
 * addresses), framed in a browser window. Files: public/solutions/screens/<view>.webp (1920x1200).
 */
export function ProductPreview({ view }: { view: ProductPreviewView }) {
  const v = VIEWS[view];
  return (
    <figure className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-50px_rgba(15,23,42,0.7)]">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
        ))}
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-xs text-[#64748B] ring-1 ring-[#E2E8F0]">{v.url}</span>
      </div>
      <Image
        src={`/solutions/screens/${view}.webp`}
        alt={v.alt}
        width={1920}
        height={1200}
        sizes="(min-width: 1024px) 760px, 100vw"
        quality={90}
        className="block h-auto w-full"
      />
    </figure>
  );
}
