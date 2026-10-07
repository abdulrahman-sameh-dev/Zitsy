import { createServer, type Server } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Fixed port so the app and the test workers can agree on the stub URL. */
export const STUB_PORT = 4599;

export const CAPTURE_FILE = path.resolve(process.cwd(), "e2e", ".resend-capture.json");

export interface CapturedEmail {
  receivedAt: string;
  idempotencyKey: string | null;
  from?: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text?: string;
}

export function readCapturedEmails(): CapturedEmail[] {
  try {
    return JSON.parse(readFileSync(CAPTURE_FILE, "utf8")) as CapturedEmail[];
  } catch {
    return [];
  }
}

const TRACK_URL_PATTERN = /https?:\/\/[^\s"'<>]+\/track-order\/[A-Za-z0-9_-]+/;

/** Pulls the login-free tracking link out of a rendered email body. */
export function extractTrackUrl(html: string): string | null {
  const match = html.match(TRACK_URL_PATTERN);
  return match ? match[0] : null;
}

let server: Server | null = null;
let counter = 0;

/**
 * Minimal stand-in for the Resend HTTP API (`POST /emails`). Every accepted
 * send is appended to `CAPTURE_FILE` so tests can assert on real, rendered
 * content without ever reaching a real recipient.
 */
export function startStub(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = createServer((req, res) => {
      const url = req.url ?? "";
      if (req.method === "POST" && url.startsWith("/emails")) {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const payload = JSON.parse(
              Buffer.concat(chunks).toString("utf8"),
            ) as Record<string, unknown>;
            const rawTo = payload.to;
            const entry: CapturedEmail = {
              receivedAt: new Date().toISOString(),
              idempotencyKey: (req.headers["idempotency-key"] as string | undefined) ?? null,
              from: typeof payload.from === "string" ? payload.from : undefined,
              to: Array.isArray(rawTo) ? String(rawTo[0]) : String(rawTo ?? ""),
              replyTo:
                (payload.replyTo as string | undefined) ??
                (payload.reply_to as string | undefined) ??
                null,
              subject: typeof payload.subject === "string" ? payload.subject : "",
              html: typeof payload.html === "string" ? payload.html : "",
              text: typeof payload.text === "string" ? payload.text : undefined,
            };
            const current = readCapturedEmails();
            current.push(entry);
            writeFileSync(CAPTURE_FILE, `${JSON.stringify(current, null, 2)}\n`);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ id: `stub-${(counter += 1)}` }));
          } catch {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ message: "bad payload" }));
          }
        });
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
    server.once("error", reject);
    server.listen(STUB_PORT, "127.0.0.1", () => resolve());
  });
}

export function stopStub(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    const active = server;
    server = null;
    active.close(() => resolve());
  });
}
