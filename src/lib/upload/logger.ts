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

/** Development-only binary upload timing (start, end, duration, Mbps). */
export function logUploadBinaryTiming(options: {
  fileName: string;
  fileSize: number;
  startedAtMs: number;
  uploadMethod: "tus" | "signed_put";
  resumed?: boolean;
}) {
  if (process.env.NODE_ENV !== "development") return;

  const endedAtMs = Date.now();
  const durationSec = (endedAtMs - options.startedAtMs) / 1000;
  const megabits = (options.fileSize * 8) / 1_000_000;
  const averageMbps = durationSec > 0 ? megabits / durationSec : 0;

  console.info("[upload:timing]", {
    fileName: options.fileName,
    fileSize: options.fileSize,
    fileSizeLabel: `${(options.fileSize / (1024 * 1024)).toFixed(2)} MB`,
    uploadStart: new Date(options.startedAtMs).toISOString(),
    uploadEnd: new Date(endedAtMs).toISOString(),
    durationSec: Math.round(durationSec * 10) / 10,
    averageMbps: Math.round(averageMbps * 100) / 100,
    uploadMethod: options.uploadMethod,
    resumed: options.resumed ?? false,
  });
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
