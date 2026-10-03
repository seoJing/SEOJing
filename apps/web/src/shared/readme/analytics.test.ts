import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackReadmeInterest } from "./analytics";

const sessionKey = "seojing_analytics_session_v1";
const optOutKey = "seojing_analytics_opt_out";

function emittedEvent(fetchMock: ReturnType<typeof vi.fn>) {
  const [, options] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return (
    JSON.parse(String(options.body)) as {
      events: Array<Record<string, unknown>>;
    }
  ).events[0]!;
}

describe("README interest telemetry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      sessionKey,
      JSON.stringify({ id: "s_readme-test", createdAt: Date.now() }),
    );
    fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "readme-event" });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: () => false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    Reflect.deleteProperty(navigator, "sendBeacon");
    Reflect.deleteProperty(navigator, "doNotTrack");
  });

  it("labels the landing page without claiming every visitor chose synthetic mode", () => {
    trackReadmeInterest();
    const event = emittedEvent(fetchMock);
    expect(event.event_type).toBe("post_view");
    expect(event.content).toMatchObject({
      content_slug: "readme",
      content_kind: "page",
    });
    expect(event.event).toEqual({ source: "readme_landing" });
  });

  it("records only a fixed stage/mode identifier for an uploaded-document journey", () => {
    trackReadmeInterest("reading", "user", "blog");
    const event = emittedEvent(fetchMock);
    expect(event.event_type).toBe("section_engagement");
    expect(event.content).toMatchObject({ section_id: "readme_user_reading" });
    expect(event.event).toEqual({ action: "enter" });
    expect(JSON.stringify(event)).not.toMatch(
      /resume_filename|resume_base64|job_text/,
    );
  });

  it("keeps contest interest separate from the upload-capable page", () => {
    trackReadmeInterest(undefined, "example", "contest");
    const event = emittedEvent(fetchMock);
    expect(event.content).toMatchObject({ content_slug: "readme/contest" });
    expect(event.event).toEqual({ source: "contest_synthetic" });
  });

  it("respects analytics opt-out", () => {
    window.sessionStorage.setItem(optOutKey, "true");
    trackReadmeInterest("report", "user");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses sendBeacon without duplicate fetch when available", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: () => true,
    });
    trackReadmeInterest("job", "example");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
