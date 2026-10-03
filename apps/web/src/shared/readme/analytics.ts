import {
  ANALYTICS_ENDPOINT,
  classifyReferrer,
  createAnalyticsEvent,
  isAnalyticsDisabled,
  readOrCreateSessionId,
  viewportBucket,
} from "@/widgets/article-analytics/article-analytics.utils";

type DemoSection = "job" | "resume" | "reading" | "report";
type DemoMode = "example" | "user";
type DemoSurface = "blog" | "contest";

export function trackReadmeInterest(
  section?: DemoSection,
  mode: DemoMode = "example",
  surface: DemoSurface = "blog",
) {
  try {
    const storage = window.sessionStorage;
    if (isAnalyticsDisabled(storage, navigator.doNotTrack)) return;

    const sessionId = readOrCreateSessionId(storage);
    const event = createAnalyticsEvent(
      sessionId,
      section ? "section_engagement" : "post_view",
      {
        content_slug: surface === "contest" ? "readme/contest" : "readme",
        content_kind: "page",
        canonical_url: `${window.location.origin}${surface === "contest" ? "/readme/contest" : "/readme"}`,
        ...(section ? { section_id: `readme_${mode}_${section}` } : {}),
      },
      section
        ? { action: "enter" }
        : {
            source:
              surface === "contest" ? "contest_synthetic" : "readme_landing",
          },
      {
        viewport: viewportBucket(window.innerWidth),
        locale: navigator.language?.startsWith("ko") ? "ko" : "unknown",
        referrer_class: classifyReferrer(
          document.referrer,
          window.location.origin,
        ),
      },
    );
    const payload = JSON.stringify({ events: [event] });
    if (
      navigator.sendBeacon?.(
        ANALYTICS_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      )
    ) {
      return;
    }
    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Telemetry is best-effort and never blocks the demo.
    });
  } catch {
    // Storage or browser APIs can be unavailable in privacy modes.
  }
}
