import http from "node:http";
import { randomUUID } from "node:crypto";

const DEFAULT_SITE_ORIGIN = "https://seojing.com";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        reject(Object.assign(new Error("payload too large"), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function corsHeaders(req, siteOrigin) {
  const origin = req.headers.origin;
  if (origin === siteOrigin) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-request-id",
      vary: "Origin",
    };
  }
  return { vary: "Origin" };
}

function routeToOrigin(pathname) {
  const routes = new Map([
    ["/api/healthz", { method: "GET", upstream: "/healthz", public: true }],
    [
      "/api/analytics/events",
      { method: "POST", upstream: "/v1/analytics/events", public: true },
    ],
    [
      "/api/rag/query",
      { method: "POST", upstream: "/v1/rag/query", public: true },
    ],
    [
      "/api/tts/jobs",
      { method: "POST", upstream: "/v1/tts/jobs", public: true },
    ],
  ]);
  return routes.get(pathname);
}

function normalizeRequestId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
    ? value
    : randomUUID();
}

async function proxyToOrigin({
  req,
  res,
  route,
  originBase,
  proxyToken,
  timeoutMs,
  requestId,
  responseHeaders,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error("request timeout"), { status: 408 }));
    });
    const body = req.method === "GET" ? undefined : await readBody(req);
    const upstream = await fetch(new URL(route.upstream, originBase), {
      method: route.method,
      body,
      signal: controller.signal,
      headers: {
        "content-type": req.headers["content-type"] ?? "application/json",
        "x-request-id": requestId,
        "x-seojing-proxy-token": proxyToken,
      },
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      ...responseHeaders,
      "content-type":
        upstream.headers.get("content-type") ??
        "application/json; charset=utf-8",
      "x-request-id": upstream.headers.get("x-request-id") ?? requestId,
      "cache-control":
        route.upstream === "/healthz" ? "no-store" : "private, no-store",
    });
    res.end(text);
  } catch (error) {
    const status = error.status ?? 502;
    const code =
      error.status === 413
        ? "payload_too_large"
        : error.status === 408
          ? "request_timeout"
          : error.name === "AbortError"
            ? "upstream_timeout"
            : "upstream_unavailable";
    json(
      res,
      status,
      { ok: false, error: code, degraded: true, request_id: requestId },
      { ...responseHeaders, "x-request-id": requestId },
    );
  } finally {
    clearTimeout(timer);
  }
}

export function createWorkerProxy(options = {}) {
  const originBase = options.originBase ?? "http://127.0.0.1:8789";
  const siteOrigin = options.siteOrigin ?? DEFAULT_SITE_ORIGIN;
  const proxyToken = options.proxyToken;
  const timeoutMs = options.timeoutMs ?? 750;

  if (!proxyToken) {
    throw new Error("SEOJING_PROXY_TOKEN is required");
  }

  return http.createServer(async (req, res) => {
    const requestId = normalizeRequestId(req.headers["x-request-id"]);
    const url = new URL(req.url ?? "/", "http://worker.local");
    const headers = {
      ...corsHeaders(req, siteOrigin),
      "x-request-id": requestId,
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    if (req.headers.origin && req.headers.origin !== siteOrigin) {
      json(res, 403, { ok: false, error: "origin_not_allowed" }, headers);
      return;
    }

    if (url.pathname.startsWith("/api/admin")) {
      json(
        res,
        404,
        { ok: false, error: "admin_not_exposed_by_public_worker_proxy" },
        headers,
      );
      return;
    }

    const route = routeToOrigin(url.pathname);
    if (!route || route.method !== req.method) {
      json(
        res,
        404,
        { ok: false, error: "not_found", path: url.pathname },
        headers,
      );
      return;
    }

    await proxyToOrigin({
      req,
      res,
      route,
      originBase,
      proxyToken,
      timeoutMs,
      requestId,
      responseHeaders: headers,
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8788);
  const server = createWorkerProxy({
    originBase: process.env.MACMINI_API_ORIGIN,
    siteOrigin: process.env.PUBLIC_SITE_ORIGIN,
    proxyToken: process.env.SEOJING_PROXY_TOKEN,
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Worker proxy spike listening on http://127.0.0.1:${port}`);
  });
}
