import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createJsonlAnalyticsStorage,
  ingestAnalyticsEvents,
  replayAnalyticsBackup,
  type AnalyticsEventV1,
} from "./analytics-ingestion";

const tempDirs: string[] = [];

async function makeStorage() {
  const dir = await mkdtemp(path.join(tmpdir(), "seojing-analytics-"));
  tempDirs.push(dir);
  const jsonlPath = path.join(dir, "events.jsonl");
  return { dir, jsonlPath, storage: createJsonlAnalyticsStorage(jsonlPath) };
}

function validPostView(
  overrides: Partial<AnalyticsEventV1> = {},
): AnalyticsEventV1 {
  return {
    schema_version: "seojing.analytics.v1",
    event_id: "evt_7f7b8f35-84dd-4010-85c6-419d0726b731",
    session_id: "s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1",
    event_type: "post_view",
    occurred_at: "2026-06-08T04:00:00.000Z",
    content: {
      content_slug: "study/backend/day1",
      content_kind: "study_post",
      canonical_url: "https://seojing.com/blog/study/backend/day1",
    },
    client_context: {
      viewport: "lg",
      theme: "dark",
      locale: "ko",
      referrer_class: "internal",
      device_class: "desktop",
    },
    event: { source: "route_load", load_ms: 124 },
    ...overrides,
  };
}

describe("analytics ingestion MVP", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it("accepts valid events, appends privacy-safe JSONL rows, and returns only aggregate response data", async () => {
    const { jsonlPath, storage } = await makeStorage();

    const result = await ingestAnalyticsEvents({
      body: { events: [validPostView()] },
      requestId: "req-valid-001",
      receivedAt: "2026-06-08T04:00:01.000Z",
      storage,
    });

    expect(result.status).toBe(202);
    expect(result.body).toEqual({
      ok: true,
      accepted: 1,
      rejected: 0,
      request_id: "req-valid-001",
      rejected_reasons: {},
    });

    const lines = (await readFile(jsonlPath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    const row = JSON.parse(lines[0]);
    expect(row.request_id).toBe("req-valid-001");
    expect(row.received_at).toBe("2026-06-08T04:00:01.000Z");
    expect(row.event.event_type).toBe("post_view");
    expect(JSON.stringify(row)).not.toMatch(
      /raw_ip|user_agent|Mozilla|127\.0\.0\.1/,
    );
  });

  it("partially rejects invalid and privacy-forbidden events without persisting rejected payloads", async () => {
    const { jsonlPath, storage } = await makeStorage();
    const valid = validPostView({ event_id: "evt_valid_001" });
    const forbidden = validPostView({
      event_id: "evt_forbidden_001",
      event_type: "qa_interaction",
      event: { action: "submit", question: "raw question must not be stored" },
    });
    const invalid = {
      ...validPostView({ event_id: "evt_invalid_001" }),
      schema_version: "wrong",
    };

    const result = await ingestAnalyticsEvents({
      body: { events: [valid, forbidden, invalid] },
      requestId: "req-mixed-001",
      receivedAt: "2026-06-08T04:00:01.000Z",
      storage,
    });

    expect(result.status).toBe(202);
    expect(result.body.accepted).toBe(1);
    expect(result.body.rejected).toBe(2);
    expect(result.body.rejected_reasons).toEqual({
      forbidden_field: 1,
      invalid_schema_version: 1,
    });

    const raw = await readFile(jsonlPath, "utf8");
    expect(raw).toContain("evt_valid_001");
    expect(raw).not.toContain("raw question must not be stored");
    expect(raw).not.toContain("evt_forbidden_001");
    expect(raw).not.toContain("evt_invalid_001");
  });

  it("replays the append-only backup into daily aggregates for restore or verification", async () => {
    const { jsonlPath, storage } = await makeStorage();

    await ingestAnalyticsEvents({
      body: {
        events: [
          validPostView({ event_id: "evt_post_001" }),
          validPostView({
            event_id: "evt_scroll_001",
            event_type: "scroll_depth",
            event: { max_depth_percent: 75, reading_ms: 30000 },
          }),
        ],
      },
      requestId: "req-replay-001",
      receivedAt: "2026-06-08T05:00:00.000Z",
      storage,
    });

    const replay = await replayAnalyticsBackup(jsonlPath);

    expect(replay.rows).toBe(2);
    expect(replay.daily_event_counts).toEqual({
      "2026-06-08|study/backend/day1|post_view": 1,
      "2026-06-08|study/backend/day1|scroll_depth": 1,
    });
  });
});
