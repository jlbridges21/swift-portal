/**
 * Upload reliability checks: failure classification, user-facing messages, and a local
 * mock TUS server showing why per-request tokens + auth-aware retry matter.
 * Usage: npx tsx scripts/verify-upload-reliability.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import * as tus from "tus-js-client";
import {
  classifyUploadFailure,
  isTransientUploadFailure,
  parseTusClientError,
  userFacingUploadError,
  type UploadTechnicalDetails,
} from "../src/lib/upload/upload-errors";
import {
  MAX_CONCURRENT_RESUMABLE_UPLOADS,
  MAX_CONCURRENT_UPLOADS,
  TUS_RETRY_DELAYS_MS,
} from "../src/lib/upload/constants";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
}

// --- Classification ---------------------------------------------------------------
const SUPABASE_BAD_JWT =
  '{"statusCode":"403","code":"AccessDenied","error":"Unauthorized","message":"\\"exp\\" claim timestamp check failed"}';
check("400 + Supabase JWT body → auth", classifyUploadFailure(400, SUPABASE_BAD_JWT) === "auth");
check("401 → auth", classifyUploadFailure(401, "") === "auth");
check("no status → network", classifyUploadFailure(undefined, "tus: failed to upload chunk at offset 0") === "network");
check("stalled message → stalled", classifyUploadFailure(undefined, "Upload stalled: no data") === "stalled");
check("413 → too_large", classifyUploadFailure(413, "") === "too_large");
check("404 → upload_expired", classifyUploadFailure(404, "") === "upload_expired");
check("409 already exists → already_exists", classifyUploadFailure(409, "The resource already exists") === "already_exists");
check("409 lock → server", classifyUploadFailure(409, "upload locked") === "server");
check("503 → server", classifyUploadFailure(503, "") === "server");
check("400 other → rejected", classifyUploadFailure(400, "invalid mime type") === "rejected");
check("network/auth/server transient", ["network", "auth", "server", "stalled"].every((k) => isTransientUploadFailure(k as never)));
check("too_large/rejected not transient", !isTransientUploadFailure("too_large") && !isTransientUploadFailure("rejected"));

// --- Messages ---------------------------------------------------------------------
const base: UploadTechnicalDetails = {
  step: "uploading_binary",
  error: "tus: failed to upload chunk",
  uploadMethod: "tus",
  fileType: "video/mp4",
  failurePhase: "during_binary",
};
const msg = (o: Partial<UploadTechnicalDetails>) => userFacingUploadError({ ...base, ...o });
check("network message names cause + resume", /lost its connection/.test(msg({ failureKind: "network" })) && /resume/.test(msg({ failureKind: "network" })));
check("auth message mentions session", /session expired/i.test(msg({ failureKind: "auth", statusCode: 400 })));
check("stalled message", /stalled/.test(msg({ failureKind: "stalled" })));
check("server message has HTTP code", /HTTP 503/.test(msg({ failureKind: "server", statusCode: 503 })));
check("photo label for images", /^Photo /.test(msg({ failureKind: "network", fileType: "image/jpeg", uploadMethod: "signed_put" })));
check("legacy generic message gone", !/Video upload failed during storage upload\. Check connection/.test(msg({ failureKind: "network" })));
check("save failures unchanged", msg({ failurePhase: "after_binary", step: "saving_metadata", error: "Object missing from storage" }) === "Object missing from storage");

// --- Concurrency limits ------------------------------------------------------------
check("overall concurrency ≤ 3", MAX_CONCURRENT_UPLOADS <= 3);
check("one resumable at a time", MAX_CONCURRENT_RESUMABLE_UPLOADS === 1);

// --- Mock TUS server: token rotates mid-upload ---------------------------------------
async function mockTusRun(mode: "old" | "new"): Promise<{ ok: boolean; error?: string; bytes: number }> {
  let validToken = "t1";
  let offset = 0;
  let patches = 0;
  const total = 5 * 1024;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, headers: Record<string, string> = {}, body = "") => {
      res.writeHead(status, { "Tus-Resumable": "1.0.0", ...headers });
      res.end(body);
    };
    const authed = req.headers.authorization === `Bearer ${validToken}`;
    if (!authed) {
      req.resume();
      return send(400, { "Content-Type": "application/json" }, SUPABASE_BAD_JWT);
    }
    if (req.method === "POST") return send(201, { Location: "/files/1", "Upload-Offset": "0" });
    if (req.method === "HEAD") return send(200, { "Upload-Offset": String(offset), "Upload-Length": String(total) });
    if (req.method === "PATCH") {
      let n = 0;
      req.on("data", (c: Buffer) => (n += c.length));
      req.on("end", () => {
        offset += n;
        patches += 1;
        // Access token "expires" after the 2nd chunk; a fresh one is now required.
        if (patches === 2) validToken = "t2";
        send(204, { "Upload-Offset": String(offset) });
      });
      return;
    }
    send(405);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;

  // Client-side "session": refreshing returns whatever the server now accepts.
  let cachedToken = "t1";
  let forceRefresh = false;
  let authRetries = 0;

  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const upload = new tus.Upload(Buffer.alloc(total, 1), {
      endpoint: `http://127.0.0.1:${port}/files`,
      chunkSize: 1024,
      retryDelays: [...TUS_RETRY_DELAYS_MS].map(() => 10),
      headers: { authorization: `Bearer ${cachedToken}` },
      storeFingerprintForResuming: false,
      ...(mode === "new"
        ? {
            onBeforeRequest: async (req: tus.HttpRequest) => {
              if (forceRefresh) {
                cachedToken = validToken;
                forceRefresh = false;
              }
              req.setHeader("authorization", `Bearer ${cachedToken}`);
            },
            onShouldRetry: (err: tus.DetailedError | Error) => {
              const parsed = parseTusClientError(err);
              const kind = classifyUploadFailure(parsed.statusCode, parsed.body ?? parsed.message);
              if (kind === "auth") {
                forceRefresh = true;
                authRetries += 1;
                return authRetries <= 2;
              }
              return kind === "network" || kind === "server";
            },
          }
        : {}),
      onError: (err) => resolve({ ok: false, error: parseTusClientError(err).message.slice(0, 120) }),
      onSuccess: () => resolve({ ok: true }),
    });
    upload.start();
  });

  server.close();
  return { ...result, bytes: offset };
}

async function main() {
  const oldRun = await mockTusRun("old");
  check("old config fails when token rotates mid-upload (reproduces bug)", !oldRun.ok, oldRun);
  console.log(`      old config stopped at ${oldRun.bytes} / 5120 bytes: ${oldRun.error ?? ""}`);
  const newRun = await mockTusRun("new");
  check("new config refreshes token and finishes the same upload", newRun.ok && newRun.bytes === 5 * 1024, newRun);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll upload reliability checks passed");
  process.exit(failures ? 1 : 0);
}

void main();
