"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  FolderKanban,
  Plus,
  Users,
  ImageIcon,
  FolderPlus,
  UserPlus,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Home", icon: Home, exact: true },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "__action__", label: "Add", icon: Plus, isAction: true },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/clients", label: "Clients", icon: Users },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminMobilePwaNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Admin mobile navigation"
        className="admin-mobile-pwa-nav"
      >
        <div className="mx-auto flex h-[72px] max-w-lg items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            if ("isAction" in item && item.isAction) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label="Create"
                  className="flex min-h-11 min-w-11 -mt-5 flex-col items-center justify-center rounded-full bg-accent px-4 py-3 text-white shadow-lg shadow-accent/30 transition active:scale-95"
                >
                  <Plus className="h-6 w-6" />
                </button>
              );
            }

            const Icon = item.icon;
            const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition",
                  active ? "text-accent" : "text-muted hover:text-primary"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {sheetOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[95] bg-black/40"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[96] rounded-t-2xl bg-white shadow-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto w-10 rounded-full bg-slate-200 py-1 mt-2 mb-4" />
            <div className="space-y-1 px-4 pb-2">
              <ActionSheetButton
                icon={FolderPlus}
                label="Add New Project"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/admin/projects/new");
                }}
              />
              <ActionSheetButton
                icon={UserPlus}
                label="Add New Client"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/admin/clients/new");
                }}
              />
              <ActionSheetButton
                icon={ImagePlus}
                label="Add Media"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/admin/media?upload=1");
                }}
              />
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
      )}
    </>
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
