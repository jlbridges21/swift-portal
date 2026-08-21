import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { toPublicDomainState, type BusinessDomainRow } from "@/lib/custom-domain";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { getAppSettings } from "@/lib/app-settings";
import { getSubscriptionState } from "@/lib/subscription";

export type PlatformBusinessRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  comped_until: string | null;
  comped_reason: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  created_via: "platform" | "signup" | string;
  created_at: string;
  deleted_at: string | null;
  clientCount: number;
  projectCount: number;
  mediaCount: number;
  lifetimeRevenueCents: number;
  stripeStatus: string;
  lastActivityAt: string | null;
  portalUrl: string;
  daysLeftInTrial: number | null;
  daysLeftInComp: number | null;
  requiresPayment: boolean;
  isComped: boolean;
};

async function countEq(table: string, businessId: string): Promise<number> {
  const raw = await createServiceClient();
  const { count } = await raw
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  return count ?? 0;
}

export async function loadPlatformBusinesses(): Promise<PlatformBusinessRow[]> {
  const raw = await createServiceClient();
  const { data: businesses, error } = await raw
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, status, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, created_via, created_at, deleted_at"
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = businesses ?? [];
  return Promise.all(
    rows.map(async (b) => {
      const [clientCount, projectCount, mediaCount, payments, integ, activity] = await Promise.all([
        countEq("clients", b.id),
        countEq("projects", b.id),
        countEq("media_assets", b.id),
        raw.from("payments").select("amount, status").eq("business_id", b.id).eq("status", "paid"),
        raw
          .from("business_integrations")
          .select("stripe_account_status")
          .eq("business_id", b.id)
          .maybeSingle(),
        raw
          .from("activity_logs")
          .select("created_at")
          .eq("business_id", b.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const lifetimeRevenueCents = (payments.data ?? []).reduce(
        (sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0),
        0
      );

      const sub = getSubscriptionState({
        subscription_status: b.subscription_status,
        trial_ends_at: b.trial_ends_at,
        comped_until: b.comped_until,
        comped_reason: b.comped_reason,
        subscription_current_period_end: b.subscription_current_period_end,
        subscription_cancel_at_period_end: b.subscription_cancel_at_period_end,
      });

      return {
        ...b,
        subscription_cancel_at_period_end: Boolean(b.subscription_cancel_at_period_end),
        subscription_current_period_end: b.subscription_current_period_end ?? null,
        clientCount,
        projectCount,
        mediaCount,
        lifetimeRevenueCents,
        stripeStatus: integ.data?.stripe_account_status ?? "not_connected",
        lastActivityAt: activity.data?.created_at ?? b.created_at,
        portalUrl: getBusinessPortalOrigin({ slug: b.slug, custom_domain: b.custom_domain }),
        daysLeftInTrial: sub.daysLeftInTrial,
        daysLeftInComp: sub.daysLeftInComp,
        requiresPayment: sub.requiresPayment,
        isComped: sub.isComped,
      };
    })
  );
}

export function platformTotals(rows: PlatformBusinessRow[]) {
  const live = rows.filter((r) => r.status === "active" && !r.deleted_at);
  return {
    businesses: rows.length,
    live: live.length,
    clients: rows.reduce((s, r) => s + r.clientCount, 0),
    projects: rows.reduce((s, r) => s + r.projectCount, 0),
    media: rows.reduce((s, r) => s + r.mediaCount, 0),
    /** Tenant→client GMV (money studios collected from their clients). */
    clientPaymentsProcessedCents: rows.reduce((s, r) => s + r.lifetimeRevenueCents, 0),
  };
}

export async function loadPlatformAudit(filters: {
  actor?: string;
  action?: string;
  businessId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const raw = await createServiceClient();
  let q = raw
    .from("platform_audit_log")
    .select(
      "id, actor_user_id, actor_email, action, target_business_id, target_type, target_id, metadata, ip_address, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.actor?.trim()) {
    q = q.ilike("actor_email", `%${filters.actor.trim()}%`);
  }
  if (filters.action?.trim()) {
    q = q.eq("action", filters.action.trim());
  }
  if (filters.businessId?.trim()) {
    q = q.eq("target_business_id", filters.businessId.trim());
  }
  if (filters.from) {
    q = q.gte("created_at", filters.from);
  }
  if (filters.to) {
    q = q.lte("created_at", filters.to);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadBusinessDetail(id: string) {
  const raw = await createServiceClient();
  const { data: business, error } = await raw
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, custom_domain_last_checked_at, custom_domain_error, custom_domain_verification, status, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, created_via, created_at, deleted_at, updated_at, lifecycle_emails_suppressed, billing_email"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!business) return null;

  const [admins, settings, integ, listRow] = await Promise.all([
    raw
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("business_id", id)
      .eq("role", "admin")
      .order("created_at", { ascending: true }),
    getAppSettings(id),
    raw.from("business_integrations").select("*").eq("business_id", id).maybeSingle(),
    loadPlatformBusinesses().then((rows) => rows.find((r) => r.id === id) ?? null),
  ]);

  const adminRows = admins.data ?? [];
  const adminsWithAuth = await Promise.all(
    adminRows.map(async (admin) => {
      const { data } = await raw.auth.admin.getUserById(admin.id);
      const confirmedAt = data.user?.email_confirmed_at ?? null;
      const lastSignInAt = data.user?.last_sign_in_at ?? null;
      return {
        ...admin,
        emailConfirmed: Boolean(confirmedAt),
        emailConfirmedAt: confirmedAt,
        lastSignInAt,
        mustChangePassword: Boolean(data.user?.user_metadata?.must_change_password),
      };
    })
  );

  const hasUnconfirmedAdmin = adminsWithAuth.some((a) => !a.emailConfirmed);
  const hasNoAdmins = adminsWithAuth.length === 0;

  const domainRow: BusinessDomainRow = {
    id: business.id,
    slug: business.slug,
    name: business.name,
    custom_domain: business.custom_domain,
    custom_domain_status: (business as { custom_domain_status?: BusinessDomainRow["custom_domain_status"] })
      .custom_domain_status ?? null,
    custom_domain_vercel_verified: Boolean(
      (business as { custom_domain_vercel_verified?: boolean }).custom_domain_vercel_verified
    ),
    custom_domain_misconfigured:
      (business as { custom_domain_misconfigured?: boolean | null }).custom_domain_misconfigured ??
      null,
    custom_domain_last_checked_at:
      (business as { custom_domain_last_checked_at?: string | null }).custom_domain_last_checked_at ??
      null,
    custom_domain_error:
      (business as { custom_domain_error?: string | null }).custom_domain_error ?? null,
    custom_domain_verification:
      ((business as { custom_domain_verification?: Record<string, unknown> }).custom_domain_verification as Record<
        string,
        unknown
      >) ?? {},
  };

  return {
    business,
    admins: adminsWithAuth,
    settings,
    integrations: integ.data,
    stats: listRow,
    inviteNeedsAttention: hasNoAdmins || hasUnconfirmedAdmin,
    portalUrl: getBusinessPortalOrigin({
      slug: business.slug,
      custom_domain: business.custom_domain,
    }),
    domainState: toPublicDomainState(domainRow),
    fallbackSubdomain: `${business.slug}.${getPlatformRootDomain()}`,
  };
}
