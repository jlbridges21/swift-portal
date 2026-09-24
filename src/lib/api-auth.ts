import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Profile } from "@/lib/types";
import {
  isActiveStaff,
  isOwnerAdmin,
  passesAccessGate,
  type AccessGate,
} from "@/lib/staff-access";

type AdminResult =
  | { ok: true; profile: Profile; supabase: ReturnType<typeof createServerClient> }
  | { ok: false; response: NextResponse };

export type RequireAdminApiOpts = AccessGate;

/**
 * Business operator API gate.
 *
 * - Owner admin / super_admin: always ok (for operational routes).
 * - Staff: MUST pass an AccessGate — no gate means DENY (nothing implicit).
 * - Use `{ adminOnly: true }` for never-delegable / owner-only routes.
 */
export async function requireAdminApi(opts?: RequireAdminApiOpts): Promise<AdminResult> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route handlers may be read-only for cookies in some contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Profile not found." }, { status: 401 }),
    };
  }

  const p = profile as Profile;

  if (isOwnerAdmin(p)) {
    return { ok: true, profile: p, supabase };
  }

  if (isActiveStaff(p) && opts && passesAccessGate(p, opts)) {
    return { ok: true, profile: p, supabase };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
  };
}

export async function requireSuperAdminApi(): Promise<AdminResult> {
  const result = await requireAdminApi({ adminOnly: true });
  if (!result.ok) return result;

  if (result.profile.role !== "super_admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Super admin access required." }, { status: 403 }),
    };
  }

  return result;
}

export function adminFetchInit(): RequestInit {
  return { credentials: "include" };
}
