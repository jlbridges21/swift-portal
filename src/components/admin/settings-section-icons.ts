import {
  BadgeInfo,
  CalendarClock,
  UserRoundCog,
  Bell,
  Contact,
  CreditCard,
  FileText,
  FolderPlus,
  Globe,
  HandCoins,
  Mail,
  Megaphone,
  Palette,
  PanelsTopLeft,
  Plug,
  Send,
  Tag,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { SettingsSectionId } from "@/lib/settings-nav";

/** One icon per Settings section: the settings sidebar, the in-page nav and each section's heading. */
export const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  identity: BadgeInfo,
  branding: Palette,
  landing: PanelsTopLeft,
  contact: Contact,
  email: Send,
  custom_domain: Globe,
  marketing_kit: Megaphone,
  automated_emails: Mail,
  new_project_setup: FolderPlus,
  payments: CreditCard,
  services: Tag,
  booking: CalendarClock,
  team: UserRoundCog,
  team_pay: HandCoins,
  workflow: Workflow,
  notifications: Bell,
  integrations: Plug,
  tax: FileText,
  staff: Users,
};

/**
 * Thin dividers split the list into three blocks (your business and how you look online · how
 * projects, money and messages run · connections, tax and team) without changing the order the
 * help videos show.
 */
export const SETTINGS_DIVIDER_AFTER: ReadonlySet<string> = new Set(["marketing_kit", "notifications"]);

export function settingsSectionIcon(id: string): LucideIcon | null {
  return (SETTINGS_SECTION_ICONS as Record<string, LucideIcon>)[id] ?? null;
}
