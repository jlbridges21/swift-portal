import type { UploadFailurePhase, UploadTechnicalDetails } from "./upload-errors";

type UploadLogContext = {
  step: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  projectId?: string | null;
  filePath?: string;
  statusCode?: number;
  providerMessage?: string;
  uploadMethod?: "tus" | "signed_put";
  bucket?: string;
  failurePhase?: UploadFailurePhase;
  details?: unknown;
};

const REDACT_KEYS = ["token", "authorization", "signedurl", "password", "secret", "key", "apikey"];

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

const timeline: { at: string; step: string; detail?: string }[] = [];

export function resetUploadTimeline() {
  timeline.length = 0;
}

export function logUploadTimeline(step: string, detail?: string) {
  const entry = { at: new Date().toISOString(), step, detail };
  timeline.push(entry);
  console.info(`[upload:timeline] ${step}${detail ? ` — ${detail}` : ""}`);
}

export function dumpUploadTimeline() {
  if (!timeline.length) return;
  console.group("[upload:timeline:summary]");
  timeline.forEach((e) => console.info(`${e.at}  ${e.step}${e.detail ? ` — ${e.detail}` : ""}`));
  console.groupEnd();
}

export function logUploadStep(level: "info" | "warn" | "error", context: UploadLogContext) {
  const payload = sanitizeContext(context);
  const msg = `[upload:${payload.step}]`;
  if (level === "error") console.error(msg, payload);
  else if (level === "warn") console.warn(msg, payload);
  else console.info(msg, payload);
}

export function logUploadFailure(technical: UploadTechnicalDetails) {
  const payload = sanitizeContext({
    step: technical.step,
    fileName: technical.fileName,
    fileSize: technical.fileSize,
    fileType: technical.fileType,
    projectId: technical.projectId,
    filePath: technical.filePath,
    statusCode: technical.statusCode,
    providerMessage: technical.error,
    uploadMethod: technical.uploadMethod,
    bucket: technical.bucket,
    failurePhase: technical.failurePhase,
    details: {
      retryable: technical.retryable,
      supabaseError: technical.supabaseError,
      raw: technical.rawDetails,
    },
  });

  console.error("[upload:failed]", payload);
  dumpUploadTimeline();
}
