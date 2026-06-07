import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonlAnalyticsStorage } from "./analytics-ingestion";
import { handleAnalyticsCollectRequest } from "./analytics-collect-api";

const tempDirs: string[] = [];

async function makeStorage() {
  const dir = await mkdtemp(path.join(tmpdir(), "seojing-analytics-api-"));
  tempDirs.push(dir);
  const jsonlPath = path.join(dir, "events.jsonl");
  return { jsonlPath, storage: createJsonlAnalyticsStorage(jsonlPath) };
}

const VALID_BODY = {
  events: [
    {
      schema_version: "seojing.analytics.v1",
      event_id: "evt_api_001",
      session_id: "s_api_001",
      event_type: "post_view",
      occurred_at: "2026-06-08T04:00:00.000Z",
      content: {
        content_slug: "okayJing/workflow/hermes-ticket-memory",
        content_kind: "okayjing_post",
      },
      event: { source: "route_load" },
    },
  ],
};

describe("analytics collect API handler", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it("handles POST /api/analytics/events with origin allowlist, request id, and no-store response", async () => {
    const { jsonlPath, storage } = await makeStorage();
    const response = await handleAnalyticsCollectRequest(
      new Request("https://api.seojing.com/v1/analytics/events", {
        method: "POST",
        headers: {
          origin: "https://seojing.com",
          "content-type": "application/json",
          "x-request-id": "req-api-001",
        },
        body: JSON.stringify(VALID_BODY),
      }),
      {
        storage,
        allowedOrigins: ["https://seojing.com"],
        now: () => "2026-06-08T04:00:01.000Z",
      },
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://seojing.com",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      accepted: 1,
      rejected: 0,
      request_id: "req-api-001",
    });
    await expect(readFile(jsonlPath, "utf8")).resolves.toContain("evt_api_001");
  });

  it("rejects disallowed origins and oversized bodies before storage append", async () => {
    const { storage } = await makeStorage();
    const disallowed = await handleAnalyticsCollectRequest(
      new Request("https://api.seojing.com/v1/analytics/events", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(VALID_BODY),
      }),
      { storage, allowedOrigins: ["https://seojing.com"] },
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({
      error: "origin_not_allowed",
    });

    const oversized = await handleAnalyticsCollectRequest(
      new Request("https://api.seojing.com/v1/analytics/events", {
        method: "POST",
        headers: {
          origin: "https://seojing.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [
            {
              ...VALID_BODY.events[0],
              event_id: "evt_big",
              event: { source: "route_load", extra: "x".repeat(33 * 1024) },
            },
          ],
        }),
      }),
      {
        storage,
        allowedOrigins: ["https://seojing.com"],
        maxBodyBytes: 32 * 1024,
      },
    );
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      error: "payload_too_large",
    });
  });

  it("answers OPTIONS preflight but never exposes admin reads on the collect surface", async () => {
    const { storage } = await makeStorage();
    const preflight = await handleAnalyticsCollectRequest(
      new Request("https://api.seojing.com/v1/analytics/events", {
        method: "OPTIONS",
        headers: { origin: "https://seojing.com" },
      }),
      { storage, allowedOrigins: ["https://seojing.com"] },
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );

    const adminRead = await handleAnalyticsCollectRequest(
      new Request("https://api.seojing.com/admin/analytics/events", {
        method: "GET",
      }),
      { storage, allowedOrigins: ["https://seojing.com"] },
    );
    expect(adminRead.status).toBe(404);
    await expect(adminRead.json()).resolves.toMatchObject({
      error: "not_found",
    });
  });
});
