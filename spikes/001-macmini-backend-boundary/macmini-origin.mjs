import http from "node:http";
import { randomUUID } from "node:crypto";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let tooLarge = false;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (raw.length > 64 * 1024) {
        tooLarge = true;
        reject(Object.assign(new Error("payload too large"), { status: 413 }));
        req.resume();
      }
    });
    req.on("end", () => {
      if (tooLarge) return;
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(error, { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function requireProxyToken(req, res, token) {
  if (req.headers["x-seojing-proxy-token"] === token) return true;
  json(res, 401, { ok: false, error: "missing_or_invalid_proxy_token" });
  return false;
}

function requireAdminToken(req, res, token) {
  if (req.headers["x-seojing-admin-token"] === token) return true;
  json(res, 403, { ok: false, error: "admin_token_required" });
  return false;
}

export function createMacminiOrigin(options = {}) {
  const proxyToken = options.proxyToken;
  const adminToken = options.adminToken;

  if (!proxyToken || !adminToken) {
    throw new Error("SEOJING_PROXY_TOKEN and SEOJING_ADMIN_TOKEN are required");
  }

  const startedAt = new Date();

  return http.createServer(async (req, res) => {
    const requestId = req.headers["x-request-id"] || randomUUID();
    res.setHeader("x-request-id", requestId);

    const url = new URL(req.url ?? "/", "http://macmini.local");

    if (req.method === "GET" && url.pathname === "/healthz") {
      json(res, 200, {
        ok: true,
        service: "seojing-macmini-origin-spike",
        uptime_ms: Date.now() - startedAt.getTime(),
        checks: { process: "ok", local_storage: "spike-not-checked" },
      });
      return;
    }

    if (url.pathname.startsWith("/admin/")) {
      if (!requireAdminToken(req, res, adminToken)) return;
      json(res, 200, { ok: true, surface: "admin", path: url.pathname });
      return;
    }

    if (!requireProxyToken(req, res, proxyToken)) return;

    try {
      if (req.method === "POST" && url.pathname === "/v1/analytics/events") {
        const event = await readJson(req);
        json(res, 202, {
          ok: true,
          accepted: {
            event_type: event.event_type ?? "unknown",
            content_slug: event.content_slug ?? null,
            session_id: event.session_id ?? null,
          },
          privacy: "raw_ip_ua_not_persisted_in_spike",
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/rag/query") {
        const body = await readJson(req);
        json(res, 200, {
          ok: true,
          mode: "stubbed-rag",
          answer: `RAG spike placeholder for ${body.content_slug ?? "unknown content"}`,
          citations: body.content_slug ? [`/blog/${body.content_slug}`] : [],
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/tts/jobs") {
        const body = await readJson(req);
        json(res, 202, {
          ok: true,
          job_id: `tts_${requestId.toString().slice(0, 8)}`,
          status: "queued",
          content_slug: body.content_slug ?? null,
        });
        return;
      }

      json(res, 404, { ok: false, error: "not_found", path: url.pathname });
    } catch (error) {
      json(res, error.status ?? 500, { ok: false, error: error.message });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8789);
  const server = createMacminiOrigin({
    proxyToken: process.env.SEOJING_PROXY_TOKEN,
    adminToken: process.env.SEOJING_ADMIN_TOKEN,
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Mac mini origin spike listening on http://127.0.0.1:${port}`);
  });
}
