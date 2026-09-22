/**
 * Client-safe custom-domain input helpers (no server / Supabase imports).
 */

import { getPlatformRootDomain } from "@/lib/site-metadata";

const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeCustomDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  v = v.split(":")[0] ?? v;
  if (!v || !DOMAIN_RE.test(v)) return null;
  return v;
}

export function isApexDomain(domain: string): boolean {
  return domain.split(".").length === 2;
}

export function dnsHostLabel(domain: string): string {
  if (isApexDomain(domain)) return "@";
  const parts = domain.split(".");
  return parts.slice(0, -2).join(".") || parts[0];
}

/**
 * Strip scheme/path/port from a pasted host. Returns null if empty after strip.
 */
export function stripPastedHost(raw: string): string {
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/\/.*$/, "");
  v = v.replace(/\.$/, "");
  v = v.split(":")[0] ?? v;
  return v;
}

export type DomainValidationResult =
  | { ok: true; domain: string; isApex: boolean }
  | { ok: false; error: string };

export type ComposePortalDomainResult =
  | {
      ok: true;
      domain: string;
      isApex: boolean;
      subdomain: string | null;
      rootDomain: string;
      /** Soft notice when we auto-corrected the input (e.g. stripped https://). */
      notice?: string;
      /** When we split a FQDN pasted into the domain field. */
      split?: { subdomain: string; rootDomain: string };
    }
  | {
      ok: false;
      error: string;
      field?: "subdomain" | "domain";
      /** Empty subdomain should open the apex path instead. */
      redirectToApex?: boolean;
    };

/**
 * Compose a portal hostname from the two-field UI (or apex mode).
 * Specific validation messages — never a generic "invalid domain".
 */
export function composePortalDomainInput(input: {
  mode: "subdomain" | "apex";
  subdomain?: string;
  rootDomain?: string;
  apexDomain?: string;
}): ComposePortalDomainResult {
  if (input.mode === "apex") {
    const stripped = stripPastedHost(input.apexDomain ?? "");
    if (!stripped) {
      return {
        ok: false,
        field: "domain",
        error: "Enter your root domain (for example yourstudio.com) — not a subdomain.",
      };
    }
    const hadUrl = /https?:\/\//i.test(input.apexDomain ?? "") || (input.apexDomain ?? "").includes("/");
    if (stripped.split(".").length > 2) {
      return {
        ok: false,
        field: "domain",
        error: `“${stripped}” looks like a subdomain address. For apex setup enter only the root domain (e.g. ${stripped.split(".").slice(-2).join(".")}), or switch back to the subdomain form.`,
      };
    }
    const domain = normalizeCustomDomain(stripped);
    if (!domain || !isApexDomain(domain)) {
      return {
        ok: false,
        field: "domain",
        error: "Enter a root domain like yourstudio.com (letters, numbers, hyphens).",
      };
    }
    const root = getPlatformRootDomain();
    if (domain === root || domain.endsWith(`.${root}`)) {
      return {
        ok: false,
        field: "domain",
        error: `Domains under ${root} are reserved for ShootPortal.`,
      };
    }
    return {
      ok: true,
      domain,
      isApex: true,
      subdomain: null,
      rootDomain: domain,
      notice: hadUrl ? `We understood this as ${domain}.` : undefined,
    };
  }

  const subRaw = (input.subdomain ?? "").trim().toLowerCase();
  if (!subRaw) {
    return {
      ok: false,
      field: "subdomain",
      redirectToApex: true,
      error:
        "A subdomain is required here (we suggest “portal”). To point your root domain (example.com) at ShootPortal instead, open “Using an apex domain?” below.",
    };
  }
  if (subRaw === "www") {
    return {
      ok: false,
      field: "subdomain",
      error:
        "“www” is your main website. Pointing it here would replace your public site with ShootPortal. Use “portal” (or another name that is not already your website).",
    };
  }
  if (subRaw.includes(".") || subRaw.includes("/") || subRaw.includes(":")) {
    return {
      ok: false,
      field: "subdomain",
      error: "Enter only the short label (e.g. portal) — not a full domain.",
    };
  }
  if (!LABEL_RE.test(subRaw)) {
    return {
      ok: false,
      field: "subdomain",
      error: "Subdomain can only use letters, numbers, and hyphens.",
    };
  }
  if (["mail", "smtp", "ftp", "api", "cdn", "email"].includes(subRaw)) {
    return {
      ok: false,
      field: "subdomain",
      error: `“${subRaw}” is usually reserved for other services. Pick a different label such as “portal”.`,
    };
  }

  let rootRaw = stripPastedHost(input.rootDomain ?? "");
  const hadUrl =
    /https?:\/\//i.test(input.rootDomain ?? "") || (input.rootDomain ?? "").includes("/");
  if (!rootRaw) {
    return {
      ok: false,
      field: "domain",
      error: "Enter the domain you renew at your registrar (e.g. yourstudio.com).",
    };
  }

  let notice: string | undefined;
  let split: { subdomain: string; rootDomain: string } | undefined;

  // Pasted FQDN into the domain field (portal.example.com) → split instead of portal.portal.example.com
  if (rootRaw.split(".").length > 2) {
    const parts = rootRaw.split(".");
    const inferredRoot = parts.slice(-2).join(".");
    const inferredSub = parts.slice(0, -2).join(".");
    if (inferredSub === "www") {
      // https://www.example.com pasted as domain → use example.com, keep the Subdomain field
      rootRaw = inferredRoot;
      notice = hadUrl
        ? `We understood this as ${inferredRoot} (ignored “www” — that is your main website, not your portal).`
        : `We used ${inferredRoot} and ignored “www” — that is your main website. Your portal subdomain stays “${subRaw || "portal"}”.`;
    } else {
      split = { subdomain: inferredSub, rootDomain: inferredRoot };
      rootRaw = inferredRoot;
      notice = `We split that into subdomain “${inferredSub}” and domain “${inferredRoot}”.`;
    }
  }

  const effectiveSub = split?.subdomain ?? subRaw;
  if (effectiveSub === "www") {
    return {
      ok: false,
      field: "subdomain",
      error:
        "“www” is your main website. Pointing it here would replace your public site with ShootPortal. Use “portal”.",
    };
  }

  const rootDomain = normalizeCustomDomain(rootRaw);
  if (!rootDomain || !isApexDomain(rootDomain)) {
    return {
      ok: false,
      field: "domain",
      error: "Enter your root domain like yourstudio.com (not a subdomain).",
    };
  }

  const root = getPlatformRootDomain();
  if (rootDomain === root || rootDomain.endsWith(`.${root}`)) {
    return {
      ok: false,
      field: "domain",
      error: `Domains under ${root} are reserved for ShootPortal.`,
    };
  }

  const domain = `${effectiveSub}.${rootDomain}`;
  if (!normalizeCustomDomain(domain)) {
    return { ok: false, error: "That combination is not a valid hostname." };
  }

  if (hadUrl && !notice) {
    notice = `We understood the domain as ${rootDomain}.`;
  }

  return {
    ok: true,
    domain,
    isApex: false,
    subdomain: effectiveSub,
    rootDomain,
    notice,
    split,
  };
}

export function validateCustomDomainCandidate(raw: unknown): DomainValidationResult {
  const domain = normalizeCustomDomain(raw);
  if (!domain) {
    return {
      ok: false,
      error: "Enter a valid domain like portal.yourstudio.com (letters, numbers, hyphens).",
    };
  }

  const root = getPlatformRootDomain();
  if (domain === root || domain.endsWith(`.${root}`)) {
    return {
      ok: false,
      error: `Domains under ${root} are reserved for ShootPortal. Use your own domain (e.g. portal.yourstudio.com).`,
    };
  }

  const first = domain.split(".")[0];
  if (first === "www" && !isApexDomain(domain)) {
    return {
      ok: false,
      error:
        "“www” is your main website. Pointing it here would replace your public site with ShootPortal. Use a subdomain like portal.yourstudio.com instead.",
    };
  }

  return { ok: true, domain, isApex: isApexDomain(domain) };
}
