/**
 * Vercel project-domain REST client for self-serve custom domains.
 *
 * Verified against Vercel docs (2026-08-21):
 * - POST   /v10/projects/{idOrName}/domains          — add
 * - GET    /v9/projects/{idOrName}/domains/{domain}  — get status
 * - POST   /v9/projects/{idOrName}/domains/{domain}/verify — ownership verify
 * - DELETE /v9/projects/{idOrName}/domains/{domain}  — remove from project
 * - GET    /v6/domains/{domain}/config               — DNS config / misconfigured
 *
 * Auth: Authorization: Bearer <VERCEL_API_TOKEN>
 * Team projects: ?teamId=<VERCEL_TEAM_ID>
 */

export type VercelDomainVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: VercelDomainVerification[];
  createdAt?: number;
  updatedAt?: number;
};

export type VercelDomainConfig = {
  configuredBy: "A" | "CNAME" | "http" | "dns-01" | null;
  misconfigured: boolean;
  recommendedCNAME: { rank: number; value: string }[];
  recommendedIPv4: { rank: number; value: string[] }[];
  acceptedChallenges?: string[];
};

export type VercelApiError = {
  status: number;
  code?: string;
  message: string;
};

const API_BASE = "https://api.vercel.com";

export function isVercelDomainApiConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim()
  );
}

function projectId(): string {
  return process.env.VERCEL_PROJECT_ID!.trim();
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function teamQueryJoin(pathHasQuery: boolean): string {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!teamId) return "";
  return `${pathHasQuery ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
}

async function vercelFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: VercelApiError }> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  if (!token || !process.env.VERCEL_PROJECT_ID?.trim()) {
    return {
      ok: false,
      error: {
        status: 503,
        code: "vercel_not_configured",
        message: "Vercel domain API is not configured.",
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const errObj = json as { error?: { code?: string; message?: string }; message?: string } | null;
      return {
        ok: false,
        error: {
          status: res.status,
          code: errObj?.error?.code,
          message:
            errObj?.error?.message ||
            errObj?.message ||
            text.slice(0, 200) ||
            `Vercel API ${res.status}`,
        },
      };
    }

    return { ok: true, data: json as T };
  } catch (e) {
    return {
      ok: false,
      error: {
        status: 502,
        message: e instanceof Error ? e.message : "Vercel API request failed",
      },
    };
  }
}

export async function vercelAddProjectDomain(
  domain: string
): Promise<{ ok: true; data: VercelProjectDomain } | { ok: false; error: VercelApiError }> {
  return vercelFetch<VercelProjectDomain>(
    "POST",
    `/v10/projects/${encodeURIComponent(projectId())}/domains${teamQuery()}`,
    { name: domain }
  );
}

export async function vercelGetProjectDomain(
  domain: string
): Promise<{ ok: true; data: VercelProjectDomain } | { ok: false; error: VercelApiError }> {
  return vercelFetch<VercelProjectDomain>(
    "GET",
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(domain)}${teamQuery()}`
  );
}

export async function vercelVerifyProjectDomain(
  domain: string
): Promise<{ ok: true; data: VercelProjectDomain } | { ok: false; error: VercelApiError }> {
  return vercelFetch<VercelProjectDomain>(
    "POST",
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(domain)}/verify${teamQuery()}`
  );
}

export async function vercelRemoveProjectDomain(
  domain: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: VercelApiError }> {
  return vercelFetch(
    "DELETE",
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(domain)}${teamQuery()}`
  );
}

export async function vercelGetDomainConfig(
  domain: string
): Promise<{ ok: true; data: VercelDomainConfig } | { ok: false; error: VercelApiError }> {
  const pid = process.env.VERCEL_PROJECT_ID?.trim();
  const q = `projectIdOrName=${encodeURIComponent(pid || "")}`;
  return vercelFetch<VercelDomainConfig>(
    "GET",
    `/v6/domains/${encodeURIComponent(domain)}/config?${q}${teamQueryJoin(true)}`
  );
}

/** Fallback DNS targets when config API returns empty recommendations. */
export const VERCEL_DEFAULT_CNAME = "cname.vercel-dns.com";
export const VERCEL_DEFAULT_A = "76.76.21.21";
