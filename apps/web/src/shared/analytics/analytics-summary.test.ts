import { describe, expect, it } from "vitest";
import type { StoredAnalyticsEvent } from "./analytics-ingestion";
import {
  buildOpsAnalyticsSummary,
  buildPublicAnalyticsSummary,
  type AnalyticsContentInventoryItem,
} from "./analytics-summary";

const inventory: AnalyticsContentInventoryItem[] = [
  {
    slug: "study/backend/day1",
    title: "백엔드 Day 1",
    kind: "study_post",
    published_at: "2026-06-01",
  },
  {
    slug: "okayJing/workflow/memory",
    title: "오케이징 메모리",
    kind: "okayjing_post",
    published_at: "2026-06-03",
  },
];

function row(
  eventType: StoredAnalyticsEvent["event"]["event_type"],
  slug = "study/backend/day1",
  receivedAt = "2026-06-10T00:00:00.000Z",
): StoredAnalyticsEvent {
  return {
    schema_version: "seojing.analytics.v1",
    request_id: `req_${eventType}_${receivedAt}`,
    received_at: receivedAt,
    event: {
      schema_version: "seojing.analytics.v1",
      event_id: `evt_${eventType}_${receivedAt}`,
      session_id: "s_demo",
      event_type: eventType,
      occurred_at: receivedAt,
      content: {
        content_slug: slug,
        content_kind: slug.startsWith("okayJing")
          ? "okayjing_post"
          : "study_post",
      },
      event: eventType === "post_view" ? { source: "route_load" } : {},
    },
  };
}

describe("analytics summary", () => {
  it("builds a public-safe summary with small-bucket suppression", () => {
    const summary = buildPublicAnalyticsSummary({
      rows: [
        row("post_view"),
        row("post_view", "okayJing/workflow/memory"),
        row("tts_interaction"),
      ],
      inventory,
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    expect(summary.total_events).toBe(3);
    expect(summary.total_post_views).toBe(2);
    expect(summary.event_counts.tts_interaction).toBe(1);
    expect(summary.top_posts[0]).toMatchObject({
      slug: "study/backend/day1",
      title: "백엔드 Day 1",
      views: 1,
      display_views: null,
      suppressed: true,
      interactions: 1,
    });
    expect(summary.privacy_contract).toMatchObject({
      raw_ip: "not_collected",
      session_ids: "not_exposed",
    });
  });

  it("uses content inventory when there are no live events", () => {
    const summary = buildPublicAnalyticsSummary({
      rows: [],
      inventory,
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    expect(summary.source).toBe("content-inventory");
    expect(summary.content_inventory).toEqual({
      total_posts: 2,
      posts_by_kind: { study_post: 1, okayjing_post: 1 },
      latest_published_at: "2026-06-03",
    });
  });

  it("keeps ops summary sanitized without session id or raw payload", () => {
    const summary = buildOpsAnalyticsSummary({
      rows: [row("post_view")],
      inventory,
      generatedAt: "2026-06-10T00:00:00.000Z",
      rejectedReasons: { forbidden_field: 2 },
    });

    expect(summary.ingestion_health).toMatchObject({
      status: "ready",
      total_events: 1,
    });
    expect(summary.rejected_reasons).toEqual({ forbidden_field: 2 });
    expect(summary.recent_events[0]).toEqual({
      received_at: "2026-06-10T00:00:00.000Z",
      event_type: "post_view",
      content_slug: "study/backend/day1",
      content_kind: "study_post",
      request_id: "req_post_view_2026-06-10T00:00:00.000Z",
    });
    expect(JSON.stringify(summary)).not.toContain("s_demo");
  });
});
