import { describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_SCHEMA_VERSION,
  ANALYTICS_SESSION_KEY,
  classifyReferrer,
  contentKindFromSlug,
  copiedCharsBucket,
  createAnalyticsEvent,
  isAnalyticsDisabled,
  readOrCreateSessionId,
  scrollDepthMilestones,
  sectionIdForHeading,
  shortHash,
  slugifyHeading,
  viewportBucket,
} from "./article-analytics.utils";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    store,
  };
}

describe("article analytics utils", () => {
  it("maps content kinds from canonical blog slugs", () => {
    expect(contentKindFromSlug("study/backend/day1")).toBe("study_post");
    expect(contentKindFromSlug("okayJing/workflow/ticket-memory")).toBe(
      "okayjing_post",
    );
    expect(contentKindFromSlug("devlog/ship-note")).toBe("devlog_post");
    expect(contentKindFromSlug("react/hooks")).toBe("blog_post");
  });

  it("creates privacy-safe session ids and rotates stale records", () => {
    const storage = createMemoryStorage();
    const first = readOrCreateSessionId(storage, 100, () => "uuid-1");
    const second = readOrCreateSessionId(storage, 200, () => "uuid-2");
    expect(first).toBe("s_uuid-1");
    expect(second).toBe(first);

    const stale = createMemoryStorage({
      [ANALYTICS_SESSION_KEY]: JSON.stringify({ id: "s_old", createdAt: 0 }),
    });
    expect(
      readOrCreateSessionId(stale, 25 * 60 * 60 * 1000, () => "uuid-3"),
    ).toBe("s_uuid-3");
  });

  it("honors explicit opt-out and do-not-track", () => {
    expect(
      isAnalyticsDisabled(
        createMemoryStorage({ seojing_analytics_opt_out: "true" }),
        null,
      ),
    ).toBe(true);
    expect(isAnalyticsDisabled(createMemoryStorage(), "1")).toBe(true);
    expect(isAnalyticsDisabled(createMemoryStorage(), null)).toBe(false);
  });

  it("classifies client context without storing raw referrer URLs", () => {
    expect(viewportBucket(500)).toBe("xs");
    expect(viewportBucket(1440)).toBe("xl");
    expect(classifyReferrer("", "https://seojing.com")).toBe("direct");
    expect(
      classifyReferrer("https://seojing.com/blog/a", "https://seojing.com"),
    ).toBe("internal");
    expect(
      classifyReferrer(
        "https://www.google.com/search?q=x",
        "https://seojing.com",
      ),
    ).toBe("search");
    expect(
      classifyReferrer("https://x.com/someone", "https://seojing.com"),
    ).toBe("social");
  });

  it("buckets copied code length without exposing copied code", () => {
    expect(copiedCharsBucket(80)).toBe("1-80");
    expect(copiedCharsBucket(81)).toBe("81-200");
    expect(copiedCharsBucket(500)).toBe("201-500");
    expect(copiedCharsBucket(501)).toBe("501+");
  });

  it("creates stable section ids from content slug and heading path", () => {
    const first = sectionIdForHeading(
      "study/backend/day1",
      "요청 흐름",
      "요청 흐름",
    );
    const second = sectionIdForHeading(
      "study/backend/day1",
      "요청 흐름",
      "요청 흐름",
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^sec_section_[0-9a-f]{8}$/);
    expect(slugifyHeading("Request Flow!")).toBe("request-flow");
    expect(shortHash("same input")).toBe(shortHash("same input"));
  });

  it("reports only unsent scroll depth milestones", () => {
    expect(scrollDepthMilestones(74, new Set([25]))).toEqual([50]);
    expect(scrollDepthMilestones(100, new Set([25, 50, 75, 90]))).toEqual([
      100,
    ]);
  });

  it("builds the v1 envelope with allowlisted event payload", () => {
    const event = createAnalyticsEvent(
      "s_session",
      "code_copy",
      { content_slug: "study/backend/day1", content_kind: "study_post" },
      { copied_chars_bucket: "81-200", language: "ts" },
      { viewport: "lg", referrer_class: "direct" },
      new Date("2026-06-08T04:00:00.000Z"),
      () => "uuid",
    );

    expect(event).toEqual({
      schema_version: ANALYTICS_SCHEMA_VERSION,
      event_id: "evt_uuid",
      session_id: "s_session",
      event_type: "code_copy",
      occurred_at: "2026-06-08T04:00:00.000Z",
      content: {
        content_slug: "study/backend/day1",
        content_kind: "study_post",
      },
      client_context: { viewport: "lg", referrer_class: "direct" },
      event: { copied_chars_bucket: "81-200", language: "ts" },
    });
    expect(JSON.stringify(event)).not.toContain("copied_code");
  });
});
