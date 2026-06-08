import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArticleAnalytics } from "./useArticleAnalytics";

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

function AnalyticsHarness() {
  useArticleAnalytics({ slug: "study/backend/day1", title: "Day 1" });
  return (
    <article data-article-content>
      <h2>요청 흐름</h2>
      <p>본문</p>
    </article>
  );
}

describe("useArticleAnalytics TTS bridge", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("forwards privacy-safe TTS player events into the article analytics endpoint", async () => {
    render(<AnalyticsHarness />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    vi.mocked(fetch).mockClear();

    window.dispatchEvent(
      new CustomEvent("seojing:tts-interaction", {
        detail: {
          action: "pause",
          artifact_id: "study__backend__day1__section-001",
          artifact_kind: "section",
          section_id: "요청-흐름",
          section_heading: "요청 흐름",
          playback_rate: 1.8,
          audio_status: "ready",
          available_artifact_kinds: ["summary-2m", "core-5m", "section"],
          section_artifact_count: 1,
          duration_seconds_bucket: "60-179",
          position_seconds_bucket: "30-59",
          progress_percent_bucket: "25-49",
        },
      }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1];
    const body = JSON.parse(String(init?.body));

    expect(body.events[0]).toMatchObject({
      event_type: "tts_interaction",
      content: {
        content_slug: "study/backend/day1",
        content_kind: "study_post",
        section_id: "요청-흐름",
        section_heading: "요청 흐름",
      },
      event: {
        action: "pause",
        artifact_id: "study__backend__day1__section-001",
        artifact_kind: "section",
        playback_rate: 1.8,
        audio_status: "ready",
        available_artifact_kinds: ["summary-2m", "core-5m", "section"],
        section_artifact_count: 1,
        duration_seconds_bucket: "60-179",
        position_seconds_bucket: "30-59",
        progress_percent_bucket: "25-49",
      },
    });
    expect(JSON.stringify(body)).not.toContain("raw");
  });
});
