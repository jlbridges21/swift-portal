/** Fictional demo content only — never real tenant data. */

import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/constants";

export type DemoProject = {
  id: string;
  name: string;
  client: string;
  address: string;
  status: ProjectStatus;
};

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "p1",
    name: "Riverbend Listing Package",
    client: "Maya Ortiz",
    address: "412 Riverbend Lane",
    status: "new_request",
  },
  {
    id: "p2",
    name: "Harbor View Twilight Set",
    client: "Jordan Blake Realty",
    address: "88 Harbor View Dr",
    status: "quote_sent",
  },
  {
    id: "p3",
    name: "Cedar Grove Exterior + Aerial",
    client: "Priya Nair",
    address: "15 Cedar Grove Ct",
    status: "proposal_approved",
  },
  {
    id: "p4",
    name: "North Pier Construction Progress",
    client: "Atlas Build Co.",
    address: "900 North Pier Rd",
    status: "scheduled",
  },
  {
    id: "p5",
    name: "Elm Street Interior Walkthrough",
    client: "Sam Okonkwo",
    address: "220 Elm Street",
    status: "shoot_complete_editing",
  },
  {
    id: "p6",
    name: "Lakeside Resort Amenities",
    client: "Lakeside Hospitality",
    address: "1 Lakeside Resort Blvd",
    status: "ready_for_review",
  },
  {
    id: "p7",
    name: "Westfield Commercial Exterior",
    client: "Westfield Partners",
    address: "3400 Westfield Ave",
    status: "awaiting_payment",
  },
  {
    id: "p8",
    name: "Oakridge Family Estate",
    client: "Elena Vasquez",
    address: "77 Oakridge Way",
    status: "delivered",
  },
];

export const DEMO_PIPELINE_COLUMNS = PROJECT_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

export const DEMO_SHOOTS: {
  id: string;
  day: number;
  time: string;
  project: string;
  client: string;
  address: string;
  status: "scheduled";
  proposed?: boolean;
  counter?: boolean;
  confirmed?: boolean;
}[] = [
  {
    id: "s1",
    day: 12,
    time: "9:00 AM",
    project: "North Pier Construction Progress",
    client: "Atlas Build Co.",
    address: "900 North Pier Rd",
    status: "scheduled",
    proposed: true,
  },
  {
    id: "s2",
    day: 14,
    time: "4:30 PM",
    project: "Harbor View Twilight Set",
    client: "Jordan Blake Realty",
    address: "88 Harbor View Dr",
    status: "scheduled",
    counter: true,
  },
  {
    id: "s3",
    day: 18,
    time: "10:00 AM",
    project: "Cedar Grove Exterior + Aerial",
    client: "Priya Nair",
    address: "15 Cedar Grove Ct",
    status: "scheduled",
    confirmed: true,
  },
];

export const DEMO_MESSAGES = {
  clientName: "Maya Ortiz",
  clientEmail: "maya@example-studio.test",
  thread: [
    {
      id: "m1",
      role: "admin" as const,
      body: "Hi Maya — your preliminary estimate for Riverbend is ready. Take a look when you have a minute.",
      at: "10:14 AM",
      receipt: "Delivered",
    },
    {
      id: "m2",
      role: "client" as const,
      body: "Looks good. Can we shoot Saturday morning instead of Friday?",
      at: "10:22 AM",
    },
    {
      id: "m3",
      role: "admin" as const,
      body: "Saturday at 9:00 AM works. I proposed it in the portal — confirm when you’re ready.",
      at: "10:25 AM",
      receipt: "Read · just now",
    },
  ],
};

export const DEMO_MEDIA = [
  { id: "ph1", title: "Front elevation", folder: "Exteriors", selected: false },
  { id: "ph2", title: "Dusk aerial", folder: "Aerial", selected: true },
  { id: "ph3", title: "Kitchen island", folder: "Interiors", selected: false },
  { id: "ph4", title: "Primary suite", folder: "Interiors", selected: false },
  { id: "ph5", title: "Back patio", folder: "Exteriors", selected: false },
  { id: "ph6", title: "Neighborhood context", folder: "Aerial", selected: false },
] as const;

export const DEMO_CLIENTS = [
  {
    name: "Maya Ortiz",
    company: "Ortiz Home Group",
    projects: 2,
    revenue: 4200,
    outstanding: 0,
  },
  {
    name: "Jordan Blake",
    company: "Jordan Blake Realty",
    projects: 5,
    revenue: 18600,
    outstanding: 890,
  },
  {
    name: "Priya Nair",
    company: null,
    projects: 1,
    revenue: 950,
    outstanding: 0,
  },
  {
    name: "Atlas Build Co.",
    company: "Atlas Build Co.",
    projects: 3,
    revenue: 12400,
    outstanding: 2100,
  },
  {
    name: "Elena Vasquez",
    company: "Vasquez Estates",
    projects: 4,
    revenue: 9800,
    outstanding: 0,
  },
] as const;

export const DEMO_TABS = [
  {
    id: "projects",
    label: "Projects",
    headline: "See every job on one board",
    blurb: "Real pipeline stages — drag work forward as estimates, shoots, and deliveries happen.",
  },
  {
    id: "calendar",
    label: "Calendar",
    headline: "Schedule without the text chain",
    blurb: "Propose a time, get a counter-offer, lock the shoot — all inside the portal.",
  },
  {
    id: "messages",
    label: "Messages",
    headline: "Talk where the work lives",
    blurb: "Admin and client messages stay on the project thread, with read receipts.",
  },
  {
    id: "media",
    label: "Media",
    headline: "Deliver files like a studio",
    blurb: "Folders, selection, and review — not another Dropbox link that expires.",
  },
  {
    id: "clients",
    label: "Clients",
    headline: "Know who is active (and who owes you)",
    blurb: "Project counts and revenue beside each client — your CRM without the CRM sprawl.",
  },
] as const;

export type DemoTabId = (typeof DEMO_TABS)[number]["id"];
