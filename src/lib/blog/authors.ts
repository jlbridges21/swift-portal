import type { BlogAuthor } from "@/lib/blog/types";

export const BLOG_AUTHORS = {
  "jackson-bridges": {
    id: "jackson-bridges",
    name: "Jackson Bridges",
    role: "Founder & Developer, ShootPortal",
    bio: "Jackson owns Swift Aerial Media, a drone photography business, and built ShootPortal to run the requests, scheduling, client communication, payments, and media delivery that come with it. He writes about the business side of aerial and real estate media.",
    credentials: [
      "Founder & Developer of ShootPortal",
      "Owner of Swift Aerial Media",
      "FAA Part 107 Certified Drone Pilot",
    ],
  },
} as const satisfies Record<string, BlogAuthor>;

export type BlogAuthorId = keyof typeof BLOG_AUTHORS;

export function getBlogAuthor(id: string): BlogAuthor {
  return (BLOG_AUTHORS as Record<string, BlogAuthor>)[id] ?? BLOG_AUTHORS["jackson-bridges"];
}
