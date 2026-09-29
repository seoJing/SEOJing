import { describe, expect, it } from "vitest";
import type { StoredAnalyticsEvent } from "./analytics-ingestion";
import { buildReadingMetrics } from "./analytics-reading-metrics";

function row(
  id: string,
  type: StoredAnalyticsEvent["event"]["event_type"],
  session: string,
  payload: Record<string, unknown> = {},
  date = "2026-09-28T12:00:00.000Z",
): StoredAnalyticsEvent {
  return {
    schema_version: "seojing.analytics.v1",
    request_id: `req_${id}`,
    received_at: date,
    event: {
      schema_version: "seojing.analytics.v1",
      event_id: id,
      session_id: session,
      event_type: type,
      occurred_at: date,
      content: {
        content_slug: "study/backend/day1",
        content_kind: "study_post",
      },
      event: payload,
    },
  };
}

describe("reading metrics", () => {
  it("counts qualifying sessions once, not repeated events or orphan interactions", () => {
    const rows = [
      row("a", "post_view", "reader-1"),
      row("b", "post_view", "reader-1"),
      row("c", "scroll_depth", "reader-1", { max_depth_percent: 75 }),
      row("d", "scroll_depth", "reader-1", { max_depth_percent: 100 }),
      row("e", "toc_interaction", "reader-1", { action: "jump" }),
      row("f", "code_copy", "reader-1"),
      row("g", "post_view", "reader-2"),
      row("h", "scroll_depth", "reader-2", { max_depth_percent: 50 }),
      row("i", "code_copy", "orphan"),
      row("a", "post_view", "reader-1"),
      row("old", "post_view", "reader-3", {}, "2026-08-01T00:00:00.000Z"),
    ];
    const metrics = buildReadingMetrics(rows, "2026-09-29T00:00:00.000Z");
    expect(metrics.total).toMatchObject({
      view_sessions: 2,
      deep_read_sessions: 1,
      engaged_sessions: 1,
      deep_read_rate: 50,
      engagement_rate: 50,
    });
    expect(
      metrics.daily.find((day) => day.date === "2026-09-28"),
    ).toMatchObject({ view_sessions: 2, deep_read_sessions: 1 });
    expect(JSON.stringify(metrics)).not.toContain("reader-1");
  });

  it("reports no rate when there is no viewed session", () => {
    const metrics = buildReadingMetrics(
      [row("a", "code_copy", "orphan")],
      "2026-09-29T00:00:00.000Z",
    );
    expect(metrics.total.view_sessions).toBe(0);
    expect(metrics.total.engagement_rate).toBeNull();
    expect(metrics.posts).toEqual([]);
  });
});
