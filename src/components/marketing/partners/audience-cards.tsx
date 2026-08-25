"use client";

import {
  BookOpen,
  Camera,
  Clapperboard,
  GraduationCap,
  Megaphone,
  Newspaper,
  Plane,
  Users,
  Video,
} from "lucide-react";
import { Reveal } from "./motion";

const AUDIENCES = [
  { label: "Drone creators", icon: Plane },
  { label: "Real estate photography educators", icon: GraduationCap },
  { label: "YouTubers", icon: Video },
  { label: "Course creators", icon: BookOpen },
  { label: "Community owners", icon: Users },
  { label: "Coaches", icon: Megaphone },
  { label: "Photography educators", icon: Camera },
  { label: "Drone professionals", icon: Plane },
  { label: "Industry newsletters", icon: Newspaper },
  { label: "Media business consultants", icon: Clapperboard },
] as const;

const SHARE_PLACES = [
  "Inside a paid course",
  "In a Skool or Discord community",
  "YouTube descriptions",
  "Instagram and TikTok content",
  "Email newsletters",
  "Resource pages",
  "Website tool recommendations",
  "Tutorials and software walkthroughs",
  "Client education content",
] as const;

export function AudienceCards() {
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {AUDIENCES.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.label} delayMs={i * 40}>
              <li className="group flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:border-[#C7D2FE] hover:shadow-md">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] transition group-hover:bg-[#4F46E5] group-hover:text-white">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-snug text-[#0F172A]">
                  {item.label}
                </span>
              </li>
            </Reveal>
          );
        })}
      </ul>

      <div className="mt-10">
        <h3 className="text-lg font-semibold text-[#0F172A]">
          Where partners can share ShootPortal
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {SHARE_PLACES.map((place) => (
            <li
              key={place}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]"
            >
              {place}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
