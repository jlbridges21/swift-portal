import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { PLATFORM_EMAIL_SENDER_DEFAULTS } from "@/lib/email-sender-policy";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { writePlatformAudit } from "@/lib/platform-audit";
import { PROTECTED_PRODUCTION_BUSINESS_IDS } from "@/lib/platform-session";
import { validateBusinessSlug } from "@/lib/reserved-subdomains";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { FALLBACK_SERVICE_TEMPLATES } from "@/lib/service-templates";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import {
  assertActivePlanKey,
  planGrantsEntitlement,
} from "@/lib/entitlements";
import { isSubscriptionStatus } from "@/lib/subscription";

const STARTER_SLUGS = [
  "aerial_photography",
  "aerial_videography",
  "drone_mapping",
  "custom_project",
] as const;

export type CreateBusinessInput = {
  name: string;
  slug: string;
  customDomain?: string | null;
  plan?: string;
  adminEmail: string;
  adminName?: string;
};

export type CreateBusinessResult = {
  businessId: string;
  slug: string;
  portalUrl: string;
  adminEmail: string;
  inviteSent: boolean;
  stagesNote: string;
};

function normalizeDomain(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
  return v || null;
}

export async function createBusinessForPlatform(
  input: CreateBusinessInput,
  actor: { id: string; email: string | null }
): Promise<CreateBusinessResult> {
  const name = input.name.trim();
  if (!name) throw new Error("Business name is required.");
  const slugCheck = validateBusinessSlug(input.slug);
  if (!slugCheck.ok) throw new Error(slugCheck.error);
  const customDomain = normalizeDomain(input.customDomain);
  const planRow = await assertActivePlanKey(input.plan || "studio");
  const plan = planRow.key;
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!adminEmail || !adminEmail.includes("@")) throw new Error("A valid admin email is required.");

  if (customDomain && !(await planGrantsEntitlement(plan, "custom_domain"))) {
    throw new Error(
      `Custom domain is not included on the ${planRow.name} plan. Choose a plan that includes custom domain (e.g. Studio).`
    );
  }

  const raw = await createServiceClient();

  const { data: slugTaken } = await raw.from("businesses").select("id").eq("slug", slugCheck.slug).maybeSingle();
  if (slugTaken) throw new Error("That slug is already in use.");
  if (customDomain) {
    const { data: domainTaken } = await raw
      .from("businesses")
      .select("id")
      .eq("custom_domain", customDomain)
      .maybeSingle();
    if (domainTaken) throw new Error("That custom domain is already in use.");
  }

  const { data: business, error: bizErr } = await raw
    .from("businesses")
    .insert({
      name,
      slug: slugCheck.slug,
      custom_domain: customDomain,
      plan,
      status: "active",
    })
    .select("id, slug, name, custom_domain")
    .single();
  if (bizErr || !business) throw new Error(bizErr?.message || "Failed to create business.");

  const businessId = business.id as string;

  try {
    const settings = structuredClone(DEFAULT_APP_SETTINGS);
    settings.business = {
      ...PLATFORM_BUSINESS_DEFAULTS,
      businessName: name,
      portalName: name,
      legalName: name,
      adminDisplayName: name,
    };
    settings.email = {
      ...settings.email,
      ...PLATFORM_EMAIL_SENDER_DEFAULTS,
      fromName: name,
      senderEmail: "",
      senderMode: "platform",
      domainVerificationStatus: "unverified",
    };

    const { error: settingsErr } = await raw.from("business_settings").insert({
      business_id: businessId,
      settings,
      updated_by: actor.id,
    });
    if (settingsErr) throw new Error(settingsErr.message);

    const { error: integErr } = await raw.from("business_integrations").insert({
      business_id: businessId,
      stripe_account_status: "not_connected",
    });
    if (integErr) throw new Error(integErr.message);

    const starter = FALLBACK_SERVICE_TEMPLATES.filter((t) =>
      (STARTER_SLUGS as readonly string[]).includes(t.id)
    );
    const serviceRows = starter.map((t, i) => ({
      business_id: businessId,
      name: t.title,
      slug: t.id,
      description: (t.description ?? "").replaceAll("{{portalName}}", name).replaceAll("{{businessName}}", name),
      preliminary_estimate_cents: t.startingAtCents,
      starting_label: t.startingLabel,
      includes: t.includes.map((line) => line.replaceAll("{{portalName}}", name)),
      line_items: t.lineItems,
      notes: t.notes,
      hide_pricing: Boolean(t.hidePricing),
      is_recommended: Boolean(t.recommended),
      display_order: i,
      is_active: true,
      aliases: t.serviceNames,
    }));
    const { error: svcErr } = await raw.from("business_services").insert(serviceRows);
    if (svcErr) throw new Error(svcErr.message);

    const invite = await inviteBusinessAdmin(businessId, adminEmail, input.adminName || name, actor, {
      isCreate: true,
    });

    await writePlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "business.create",
      targetBusinessId: businessId,
      targetType: "business",
      targetId: businessId,
      metadata: { slug: slugCheck.slug, name, adminEmail, inviteSent: invite.inviteSent },
    });

    invalidateHostLookupCache();

    return {
      businessId,
      slug: slugCheck.slug,
      portalUrl: getBusinessPortalOrigin({ slug: slugCheck.slug, custom_domain: customDomain }),
      adminEmail,
      inviteSent: invite.inviteSent,
      stagesNote:
        "business_stages does not exist yet — stage automation is still workflow settings JSON, not a table.",
    };
  } catch (error) {
    await raw.from("business_services").delete().eq("business_id", businessId);
    await raw.from("business_integrations").delete().eq("business_id", businessId);
    await raw.from("business_settings").delete().eq("business_id", businessId);
    await raw.from("businesses").delete().eq("id", businessId);
    throw error;
  }
}

export async function inviteBusinessAdmin(
  businessId: string,
  email: string,
  fullName: string,
  actor: { id: string; email: string | null },
  options?: { isCreate?: boolean; resend?: boolean }
): Promise<{ inviteSent: boolean; userId: string | null }> {
  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("id, slug, name, custom_domain")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("Business not found.");

  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
  });
  const redirectTo = `${portalUrl}/login`;

  const invited = await raw.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "admin",
      business_id: businessId,
      full_name: fullName,
    },
    redirectTo,
  });

  let userId = invited.data.user?.id ?? null;
  let inviteSent = !invited.error;

  if (invited.error) {
    const users = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw new Error(invited.error.message);
    userId = existing.id;
    await raw.auth.admin.updateUserById(existing.id, {
      user_metadata: {
        ...existing.user_metadata,
        role: "admin",
        business_id: businessId,
        full_name: fullName,
      },
    });
    inviteSent = false;
  }

  if (userId) {
    await raw
      .from("profiles")
      .update({
        role: "admin",
        business_id: businessId,
        client_id: null,
        full_name: fullName,
      })
      .eq("id", userId);
  }

  if (!options?.isCreate) {
    await writePlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: options?.resend ? "admin.invite_resend" : "admin.invite",
      targetBusinessId: businessId,
      targetType: "profile",
      targetId: userId,
      metadata: { email, inviteSent },
    });
  }

  return { inviteSent, userId };
}

export async function hardDeleteBusiness(
  businessId: string,
  actor: { id: string; email: string | null }
): Promise<void> {
  if (PROTECTED_PRODUCTION_BUSINESS_IDS.has(businessId)) {
    throw new Error("Protected production businesses cannot be hard-deleted.");
  }
  const raw = await createServiceClient();
  const { data: biz } = await raw.from("businesses").select("id, slug").eq("id", businessId).maybeSingle();
  if (!biz) throw new Error("Business not found.");

  const tables = [
    "media_asset_events",
    "media_asset_tags",
    "media_downloads",
    "media_assets",
    "media_folders",
    "project_message_reads",
    "project_messages",
    "client_message_reads",
    "client_messages",
    "notifications",
    "email_events",
    "communications",
    "activity_logs",
    "client_notes",
    "asset_reviews",
    "revisions",
    "shoot_proposals",
    "payments",
    "project_quotes",
    "project_clients",
    "tours",
    "projects",
    "properties",
    "leads",
    "clients",
    "business_services",
    "business_settings",
    "business_integrations",
    "google_calendar_connections_v2",
  ];

  const { data: profiles } = await raw.from("profiles").select("id").eq("business_id", businessId);
  for (const table of tables) {
    const { error } = await raw.from(table).delete().eq("business_id", businessId);
    if (error && !error.message.toLowerCase().includes("does not exist")) {
      throw new Error(`${table}: ${error.message}`);
    }
  }

  await raw.from("profiles").update({ business_id: null, client_id: null }).eq("business_id", businessId);

  const { error: bizErr } = await raw.from("businesses").delete().eq("id", businessId);
  if (bizErr) throw new Error(bizErr.message);

  for (const profile of profiles ?? []) {
    await raw.auth.admin.deleteUser(profile.id).catch(() => undefined);
  }

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.hard_delete",
    targetBusinessId: null,
    targetType: "business",
    targetId: businessId,
    metadata: { slug: biz.slug },
  });
  invalidateHostLookupCache();
}

export type UpdateBusinessInput = {
  name?: string;
  slug?: string;
  customDomain?: string | null;
  plan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
};

export async function updateBusinessForPlatform(
  businessId: string,
  input: UpdateBusinessInput,
  actor: { id: string; email: string | null }
) {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, plan, status, deleted_at, subscription_status, trial_ends_at"
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Business name is required.");
    patch.name = name;
  }
  if (input.slug !== undefined) {
    const slugCheck = validateBusinessSlug(input.slug);
    if (!slugCheck.ok) throw new Error(slugCheck.error);
    const { data: taken } = await raw
      .from("businesses")
      .select("id")
      .eq("slug", slugCheck.slug)
      .neq("id", businessId)
      .maybeSingle();
    if (taken) throw new Error("That slug is already in use.");
    patch.slug = slugCheck.slug;
  }
  if (input.customDomain !== undefined) {
    const customDomain = normalizeDomain(input.customDomain);
    if (customDomain) {
      const effectivePlanKey =
        input.plan !== undefined ? (await assertActivePlanKey(input.plan)).key : existing.plan;
      if (!(await planGrantsEntitlement(effectivePlanKey, "custom_domain"))) {
        throw new Error(
          "Custom domain is not included on the selected plan. Choose Studio (or another plan that includes custom domain)."
        );
      }
      const { data: taken } = await raw
        .from("businesses")
        .select("id")
        .eq("custom_domain", customDomain)
        .neq("id", businessId)
        .maybeSingle();
      if (taken) throw new Error("That custom domain is already in use.");
    }
    patch.custom_domain = customDomain;
  }
  let planChanged = false;
  if (input.plan !== undefined) {
    const planRow = await assertActivePlanKey(input.plan);
    patch.plan = planRow.key;
    planChanged = planRow.key !== existing.plan;
  }

  let subscriptionChanged = false;
  if (input.subscriptionStatus !== undefined) {
    if (!isSubscriptionStatus(input.subscriptionStatus)) {
      throw new Error("Invalid subscription_status.");
    }
    if (input.subscriptionStatus === "comped") {
      throw new Error(
        "Use Grant comped access (platform console) instead of setting subscription_status to comped."
      );
    }
    if (existing.subscription_status === "comped") {
      throw new Error(
        "This business is comped. Revoke complimentary access before changing subscription status."
      );
    }
    patch.subscription_status = input.subscriptionStatus;
    if (input.subscriptionStatus !== existing.subscription_status) {
      subscriptionChanged = true;
    }
  }
  if (input.trialEndsAt !== undefined) {
    if (input.trialEndsAt === null || input.trialEndsAt === "") {
      patch.trial_ends_at = null;
    } else {
      const parsed = new Date(input.trialEndsAt);
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error("Invalid trial_ends_at.");
      }
      patch.trial_ends_at = parsed.toISOString();
    }
    const prev = existing.trial_ends_at;
    const next = patch.trial_ends_at as string | null;
    if (prev !== next) subscriptionChanged = true;
  }

  if (Object.keys(patch).length === 0) return existing;

  const { data, error } = await raw
    .from("businesses")
    .update(patch)
    .eq("id", businessId)
    .select(
      "id, name, slug, custom_domain, plan, status, deleted_at, created_at, subscription_status, trial_ends_at"
    )
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to update business.");

  const action = subscriptionChanged
    ? "business.subscription_change"
    : planChanged
      ? "business.plan_change"
      : "business.update";

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: {
      patch,
      previous: {
        name: existing.name,
        slug: existing.slug,
        plan: existing.plan,
        subscription_status: existing.subscription_status,
        trial_ends_at: existing.trial_ends_at,
      },
    },
  });
  invalidateHostLookupCache();
  return data;
}

export async function setBusinessStatus(
  businessId: string,
  status: "active" | "suspended",
  actor: { id: string; email: string | null }
) {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select("id, status, deleted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Restore this business before changing status.");

  const { error } = await raw.from("businesses").update({ status }).eq("id", businessId);
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: status === "suspended" ? "business.suspend" : "business.reactivate",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: { previousStatus: existing.status, status },
  });
  invalidateHostLookupCache();
}

export async function softDeleteBusiness(
  businessId: string,
  actor: { id: string; email: string | null }
) {
  if (PROTECTED_PRODUCTION_BUSINESS_IDS.has(businessId)) {
    throw new Error("Protected production businesses cannot be deleted from the console.");
  }
  const raw = await createServiceClient();
  const { data: existing } = await raw.from("businesses").select("id, deleted_at").eq("id", businessId).maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Business is already deleted.");

  const { error } = await raw
    .from("businesses")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.soft_delete",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
  });
  invalidateHostLookupCache();
}
