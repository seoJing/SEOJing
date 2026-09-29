import type { StoredAnalyticsEvent } from "./analytics-ingestion";

export type ReadingMetricRow = {
  slug: string;
  view_sessions: number;
  deep_read_sessions: number;
  engaged_sessions: number;
  deep_read_rate: number | null;
  engagement_rate: number | null;
};

export type ReadingMetrics = {
  window_days: number;
  from: string;
  to: string;
  total: ReadingMetricRow;
  posts: ReadingMetricRow[];
  daily: Array<{
    date: string;
    view_sessions: number;
    deep_read_sessions: number;
  }>;
};

type Session = { viewed: boolean; deep: boolean; engaged: boolean };

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}

function isEngagement(row: StoredAnalyticsEvent): boolean {
  const { event_type: type, event } = row.event;
  return (
    type === "code_copy" ||
    type === "toc_interaction" ||
    (type === "qa_interaction" && event.action === "answer_shown") ||
    (type === "tts_interaction" && event.action === "play")
  );
}

function summarize(
  slug: string,
  sessions: Iterable<Session>,
): ReadingMetricRow {
  let viewSessions = 0;
  let deepReadSessions = 0;
  let engagedSessions = 0;
  for (const session of sessions) {
    if (!session.viewed) continue;
    viewSessions++;
    if (session.deep) deepReadSessions++;
    if (session.engaged) engagedSessions++;
  }
  return {
    slug,
    view_sessions: viewSessions,
    deep_read_sessions: deepReadSessions,
    engaged_sessions: engagedSessions,
    deep_read_rate: rate(deepReadSessions, viewSessions),
    engagement_rate: rate(engagedSessions, viewSessions),
  };
}

export function buildReadingMetrics(
  rows: StoredAnalyticsEvent[],
  generatedAt: string,
  windowDays = 30,
): ReadingMetrics {
  const to = new Date(generatedAt);
  const from = new Date(to);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - windowDays + 1);
  const sessions = new Map<string, Session>();
  const seenEventIds = new Set<string>();

  for (const row of rows) {
    const timestamp = Date.parse(row.received_at);
    if (
      !Number.isFinite(timestamp) ||
      timestamp < from.getTime() ||
      timestamp > to.getTime()
    )
      continue;
    const { event_id: eventId, session_id: sessionId, content } = row.event;
    if (
      !eventId ||
      !sessionId ||
      !content.content_slug ||
      seenEventIds.has(eventId)
    )
      continue;
    seenEventIds.add(eventId);
    const date = row.received_at.slice(0, 10);
    const key = JSON.stringify([date, content.content_slug, sessionId]);
    const session = sessions.get(key) ?? {
      viewed: false,
      deep: false,
      engaged: false,
    };
    if (row.event.event_type === "post_view") session.viewed = true;
    if (
      row.event.event_type === "scroll_depth" &&
      Number(row.event.event.max_depth_percent) >= 75
    )
      session.deep = true;
    if (isEngagement(row)) session.engaged = true;
    sessions.set(key, session);
  }

  const byPost = new Map<string, Session[]>();
  const byDate = new Map<string, Session[]>();
  for (const [key, session] of sessions) {
    const [date, slug] = JSON.parse(key) as [string, string, string];
    byPost.set(slug, [...(byPost.get(slug) ?? []), session]);
    byDate.set(date, [...(byDate.get(date) ?? []), session]);
  }

  const posts = [...byPost]
    .map(([slug, values]) => summarize(slug, values))
    .filter((item) => item.view_sessions > 0)
    .sort(
      (a, b) =>
        b.view_sessions - a.view_sessions || a.slug.localeCompare(b.slug),
    );
  const total = summarize("all", sessions.values());
  const daily: ReadingMetrics["daily"] = [];
  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = new Date(to.getTime() - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const item = summarize(date, byDate.get(date) ?? []);
    daily.push({
      date,
      view_sessions: item.view_sessions,
      deep_read_sessions: item.deep_read_sessions,
    });
  }

  return {
    window_days: windowDays,
    from: from.toISOString(),
    to: to.toISOString(),
    total,
    posts,
    daily,
  };
}
