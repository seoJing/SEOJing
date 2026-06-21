import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { pathToFileURL } from "node:url";
import {
  createJsonlAnalyticsStorage,
  type StoredAnalyticsEvent,
} from "../src/shared/analytics/analytics-ingestion";
import { handleAnalyticsCollectRequest } from "../src/shared/analytics/analytics-collect-api";
import {
  buildOpsAnalyticsSummary,
  buildPublicAnalyticsSummary,
  type AnalyticsContentInventoryItem,
} from "../src/shared/analytics/analytics-summary";

const DEFAULT_PORT = 8791;
const DEFAULT_STORAGE_PATH = "var/analytics/events.jsonl";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://seojing.com",
  "http://localhost:5173",
];

function envList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function isOpsReadAuthorized(
  req: http.IncomingMessage,
  token?: string,
): boolean {
  const authorization = req.headers.authorization;
  if (token) return authorization === `Bearer ${token}`;

  return Boolean(
    req.headers["cf-access-authenticated-user-email"] ||
    req.headers["cf-access-jwt-assertion"],
  );
}

async function readStoredEvents(
  jsonlPath: string,
): Promise<StoredAnalyticsEvent[]> {
  let raw = "";
  try {
    raw = await readFile(jsonlPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const events: StoredAnalyticsEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as StoredAnalyticsEvent);
    } catch {
      // Ignore corrupt rows for dashboard reads; ingestion only writes valid JSON.
    }
  }
  return events;
}

async function nodeRequestToWebRequest(
  req: http.IncomingMessage,
  maxBodyBytes: number,
): Promise<Request> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) {
      throw Object.assign(new Error("payload too large"), { status: 413 });
    }
    chunks.push(buffer);
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const host = headers.get("host") ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const method = req.method ?? "GET";
  const body =
    method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);

  return new Request(url, { method, headers, body });
}

async function writeWebResponse(
  res: http.ServerResponse,
  response: Response,
): Promise<void> {
  res.writeHead(
    response.status,
    Object.fromEntries(response.headers.entries()),
  );
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

export function createAnalyticsOriginServer(
  options: {
    storagePath?: string;
    allowedOrigins?: string[];
    maxBodyBytes?: number;
    contentInventory?: AnalyticsContentInventoryItem[];
    opsReadToken?: string;
  } = {},
): http.Server {
  const storagePath =
    options.storagePath ??
    process.env.SEOJING_ANALYTICS_JSONL_PATH ??
    DEFAULT_STORAGE_PATH;
  const allowedOrigins =
    options.allowedOrigins ??
    envList(
      process.env.SEOJING_ANALYTICS_ALLOWED_ORIGINS,
      DEFAULT_ALLOWED_ORIGINS,
    );
  const maxBodyBytes = positiveInteger(
    options.maxBodyBytes ?? process.env.SEOJING_ANALYTICS_MAX_BODY_BYTES,
    32 * 1024,
  );
  const contentInventory = options.contentInventory ?? [];
  const opsReadToken =
    options.opsReadToken ?? process.env.SEOJING_ANALYTICS_OPS_READ_TOKEN;
  const storage = createJsonlAnalyticsStorage(storagePath);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://analytics.local");

      if (req.method === "GET" && url.pathname === "/healthz") {
        await writeWebResponse(
          res,
          new Response(
            JSON.stringify({
              ok: true,
              service: "seojing-analytics-origin",
              storage: "append-only-jsonl",
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
              },
            },
          ),
        );
        return;
      }

      if (
        req.method === "GET" &&
        url.pathname === "/v1/analytics/public-summary"
      ) {
        const rows = await readStoredEvents(storagePath);
        await writeWebResponse(
          res,
          jsonResponse(
            200,
            buildPublicAnalyticsSummary({
              rows,
              inventory: contentInventory,
              generatedAt: new Date().toISOString(),
            }),
          ),
        );
        return;
      }

      if (
        req.method === "GET" &&
        url.pathname === "/v1/ops/analytics/summary"
      ) {
        if (!isOpsReadAuthorized(req, opsReadToken)) {
          await writeWebResponse(
            res,
            jsonResponse(401, {
              ok: false,
              error: "unauthorized",
              expected: opsReadToken
                ? "authorization bearer token"
                : "cloudflare access headers",
            }),
          );
          return;
        }

        const rows = await readStoredEvents(storagePath);
        await writeWebResponse(
          res,
          jsonResponse(
            200,
            buildOpsAnalyticsSummary({
              rows,
              inventory: contentInventory,
              generatedAt: new Date().toISOString(),
            }),
          ),
        );
        return;
      }

      const request = await nodeRequestToWebRequest(req, maxBodyBytes);
      const response = await handleAnalyticsCollectRequest(request, {
        storage,
        allowedOrigins,
        maxBodyBytes,
      });
      await writeWebResponse(res, response);
    } catch {
      const requestId = req.headers["x-request-id"] ?? randomUUID();
      res.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
        "x-request-id": String(requestId),
      });
      res.end(
        JSON.stringify({
          ok: false,
          error: "internal_error",
          request_id: requestId,
        }),
      );
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createAnalyticsOriginServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `SEOJing analytics origin listening on http://127.0.0.1:${port}`,
    );
  });
}
