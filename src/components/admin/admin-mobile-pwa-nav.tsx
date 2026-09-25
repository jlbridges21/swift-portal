"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  FolderKanban,
  Plus,
  MessageSquare,
  Image as ImageIcon,
  FolderPlus,
  UserPlus,
  ImagePlus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSearch } from "@/components/admin/admin-search-context";
import { useAdminCapabilities } from "@/components/admin/admin-capabilities-context";
import type { StaffArea } from "@/lib/staff-access";

const STAFF_AREA_HOME: Record<StaffArea, string> = {
  projects: "/admin/projects",
  clients: "/admin/clients",
  media: "/admin/media",
  calendar: "/admin/calendar",
  messages: "/admin/messages",
};

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom bar and create sheet. Permissions come from AdminCapabilitiesContext,
 * which the admin layout fills. This component does not fetch them.
 */
export function AdminMobilePwaNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { openSearch } = useAdminSearch();
  const { userRole, staffAreas, navCreate } = useAdminCapabilities();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isStaff = userRole === "staff";
  const areas = new Set(staffAreas ?? []);

  const homeHref = isStaff
    ? staffAreas && staffAreas[0]
      ? STAFF_AREA_HOME[staffAreas[0]]
      : "/staff"
    : "/admin";

  const allow = (area: StaffArea) => !isStaff || areas.has(area);

  const left: NavLink[] = [
    { href: homeHref, label: "Home", icon: Home, exact: true },
  ];
  if (allow("projects")) {
    left.push({ href: "/admin/projects", label: "Projects", icon: FolderKanban });
  }

  const right: NavLink[] = [];
  if (allow("messages")) {
    right.push({ href: "/admin/messages", label: "Messages", icon: MessageSquare });
  }
  if (allow("media")) {
    right.push({ href: "/admin/media", label: "Media", icon: ImageIcon });
  }

  const sheet: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }[] = [
    {
      label: "Search",
      icon: Search,
      onClick: () => {
        setSheetOpen(false);
        openSearch();
      },
    },
  ];
  if (navCreate.project) {
    sheet.push({
      label: "New project",
      icon: FolderPlus,
      onClick: () => {
        setSheetOpen(false);
        router.push("/admin/projects/new");
      },
    });
  }
  if (navCreate.client) {
    sheet.push({
      label: "New client",
      icon: UserPlus,
      onClick: () => {
        setSheetOpen(false);
        router.push("/admin/clients/new");
      },
    });
  }
  if (navCreate.media) {
    sheet.push({
      label: "Add media",
      icon: ImagePlus,
      onClick: () => {
        setSheetOpen(false);
        router.push("/admin/media?upload=1");
      },
    });
  }

  const itemLabels = [...left.map((item) => item.label), "Create", ...right.map((item) => item.label)];

  return (
    <>
      <nav
        aria-label="Admin mobile navigation"
        className="admin-mobile-pwa-nav"
        data-nav-items={itemLabels.join("|")}
        data-sheet-actions={sheet.map((item) => item.label).join("|")}
      >
        <div className="mx-auto grid h-[72px] max-w-lg grid-cols-[1fr_auto_1fr] items-end px-2 pb-1">
          <div className="flex items-center justify-around">
            {left.map((item) => (
              <NavItem key={item.label} item={item} pathname={pathname} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Create"
            className="-mt-5 mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition active:scale-95"
          >
            <Plus className="h-7 w-7" />
          </button>
          <div className="flex items-center justify-around">
            {right.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      </nav>

      <button
        type="button"
        className="fixed inset-0 z-[110] bg-black/40"
        aria-label="Close menu"
        hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />
      <div
        hidden={!sheetOpen}
        className="fixed inset-x-0 bottom-0 z-[111] rounded-t-2xl bg-white shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        role="dialog"
        aria-label="Create"
      >
        <div className="mx-auto mt-2 mb-4 w-10 rounded-full bg-slate-200 py-1" />
        <div className="space-y-1 px-4 pb-2">
          {sheet.map((item) => (
            <ActionSheetButton key={item.label} icon={item.icon} label={item.label} onClick={item.onClick} />
          ))}
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function NavItem({ item, pathname }: { item: NavLink; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href, item.exact);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition",
        active ? "text-accent" : "text-muted hover:text-primary"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function ActionSheetButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-primary hover:bg-slate-50 active:bg-slate-100"
    >
      <Icon className="h-5 w-5 text-accent" />
      {label}
    </button>
  );
}
