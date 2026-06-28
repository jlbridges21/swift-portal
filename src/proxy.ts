import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run session refresh on app routes and APIs, excluding static assets and webhooks.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/stripe/webhook|api/resend/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
