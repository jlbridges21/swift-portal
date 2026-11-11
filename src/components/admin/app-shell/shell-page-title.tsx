"use client";

import { usePathname } from "next/navigation";
import { useShellPageTitle, type ShellCrumb } from "@/components/admin/app-shell/admin-app-shell-context";

/**
 * Renders nothing; publishes a title to the New interface top bar from a server page that
 * has no PageHeader (e.g. a project or client detail page with its own in-page header).
 */
export function ShellPageTitle({ title, description, crumbs }: { title: string; description?: string | null; crumbs?: ShellCrumb[] }) {
  const pathname = usePathname() ?? "";
  useShellPageTitle({ title, description, crumbs }, pathname);
  return null;
}
