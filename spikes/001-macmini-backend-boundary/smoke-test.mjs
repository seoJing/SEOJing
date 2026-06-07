import assert from "node:assert/strict";
import { createMacminiOrigin } from "./macmini-origin.mjs";
import { createWorkerProxy } from "./worker-proxy.mjs";

const SITE_ORIGIN = "https://seojing.com";
const PROXY_TOKEN = "spike-proxy-token";
const ADMIN_TOKEN = "spike-admin-token";

function listen(server) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

async function run() {
  const origin = createMacminiOrigin({
    proxyToken: PROXY_TOKEN,
    adminToken: ADMIN_TOKEN,
  });
  const originBase = await listen(origin);
  const proxy = createWorkerProxy({
    originBase,
    proxyToken: PROXY_TOKEN,
    siteOrigin: SITE_ORIGIN,
    timeoutMs: 500,
  });
  const proxyBase = await listen(proxy);

  const results = [];

  try {
    {
      const { response, body } = await fetchJson(`${originBase}/healthz`);
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      results.push(
        "origin /healthz returns isolated Mac mini health without proxy token",
      );
    }

    {
      const { response, body } = await fetchJson(`${originBase}/v1/rag/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content_slug: "study/backend/day1" }),
      });
      assert.equal(response.status, 401);
      assert.equal(body.error, "missing_or_invalid_proxy_token");
      results.push(
        "origin dynamic API rejects direct browser-style calls without server-only token",
      );
    }

    {
      const requestId = "spike-request-001";
      const { response, body } = await fetchJson(`${proxyBase}/api/rag/query`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
          "x-request-id": requestId,
        },
        body: JSON.stringify({
          content_slug: "study/backend/day1",
          question: "이 글의 핵심은?",
        }),
      });
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(response.headers.get("x-request-id"), requestId);
      assert.equal(
        response.headers.get("access-control-allow-origin"),
        SITE_ORIGIN,
      );
      assert.equal(response.headers.get("vary"), "Origin");
      results.push(
        "Worker proxy forwards allowed RAG call, injects token, preserves x-request-id, and returns CORS headers",
      );
    }

    {
      const { response, body } = await fetchJson(
        `${proxyBase}/api/analytics/events`,
        {
          method: "POST",
          headers: { "content-type": "application/json", origin: SITE_ORIGIN },
          body: JSON.stringify({
            event_type: "post_view",
            content_slug: "okayJing/workflow/ticket-trigger-logic",
            session_id: "anon-session",
          }),
        },
      );
      assert.equal(response.status, 202);
      assert.equal(body.accepted.event_type, "post_view");
      assert.equal(body.privacy, "raw_ip_ua_not_persisted_in_spike");
      results.push(
        "analytics collect path accepts minimal privacy-safe event through proxy",
      );
    }

    {
      const { response, body } = await fetchJson(`${proxyBase}/api/tts/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE_ORIGIN },
        body: JSON.stringify({ content_slug: "study/backend/day7" }),
      });
      assert.equal(response.status, 202);
      assert.match(body.job_id, /^tts_/);
      results.push(
        "TTS path returns queued job instead of long request/response generation",
      );
    }

    {
      const { response, body } = await fetchJson(
        `${proxyBase}/api/admin/health`,
        {
          headers: { origin: SITE_ORIGIN },
        },
      );
      assert.equal(response.status, 404);
      assert.equal(body.error, "admin_not_exposed_by_public_worker_proxy");
      results.push("public Worker proxy does not expose admin paths");
    }

    {
      const { response } = await fetchJson(`${proxyBase}/api/rag/query`, {
        method: "OPTIONS",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/json",
        },
      });
      assert.equal(response.status, 204);
      assert.equal(
        response.headers.get("access-control-allow-origin"),
        SITE_ORIGIN,
      );
      assert.match(
        response.headers.get("access-control-allow-methods") ?? "",
        /POST/,
      );
      results.push("allowed canonical origin receives CORS preflight headers");
    }

    {
      const { response, body } = await fetchJson(`${proxyBase}/api/rag/query`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ content_slug: "study/backend/day1" }),
      });
      assert.equal(response.status, 403);
      assert.equal(body.error, "origin_not_allowed");
      results.push(
        "CORS allowlist rejects non-canonical origins before reaching Mac mini",
      );
    }

    {
      const oversizedBody = JSON.stringify({
        content_slug: "study/backend/day1",
        question: "x".repeat(70 * 1024),
      });
      const { response, body } = await fetchJson(`${proxyBase}/api/rag/query`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE_ORIGIN },
        body: oversizedBody,
      });
      assert.equal(response.status, 413);
      assert.equal(body.error, "payload_too_large");
      results.push(
        "Worker proxy rejects oversized API bodies before forwarding",
      );
    }

    {
      const deadProxy = createWorkerProxy({
        originBase: "http://127.0.0.1:1",
        proxyToken: PROXY_TOKEN,
        siteOrigin: SITE_ORIGIN,
        timeoutMs: 100,
      });
      const deadProxyBase = await listen(deadProxy);
      try {
        const { response, body } = await fetchJson(
          `${deadProxyBase}/api/rag/query`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: SITE_ORIGIN,
            },
            body: JSON.stringify({ content_slug: "study/backend/day1" }),
          },
        );
        assert.equal(response.status, 502);
        assert.equal(body.degraded, true);
      } finally {
        await close(deadProxy);
      }
      results.push(
        "upstream outage is contained to API JSON degradation, not public HTML rendering",
      );
    }
  } finally {
    await close(proxy);
    await close(origin);
  }

  console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
