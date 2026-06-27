type UploadLogContext = {
  step: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  projectId?: string;
  filePath?: string;
  statusCode?: number;
  providerMessage?: string;
  details?: unknown;
};

const REDACT_KEYS = ["token", "authorization", "signedurl", "password", "secret", "key"];

function sanitizeContext(ctx: UploadLogContext): UploadLogContext {
  const out = { ...ctx };
  if (out.details && typeof out.details === "object") {
    const d = { ...(out.details as Record<string, unknown>) };
    for (const k of Object.keys(d)) {
      if (REDACT_KEYS.some((r) => k.toLowerCase().includes(r))) {
        d[k] = "[redacted]";
      }
    }
    out.details = d;
  }
  return out;
}

export function logUploadStep(level: "info" | "warn" | "error", context: UploadLogContext) {
  const payload = sanitizeContext(context);
  const msg = `[upload:${payload.step}]`;
  if (level === "error") console.error(msg, payload);
  else if (level === "warn") console.warn(msg, payload);
  else console.info(msg, payload);
}
