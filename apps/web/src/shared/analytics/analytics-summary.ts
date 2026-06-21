import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsContentKind,
  type AnalyticsEventTypeV1,
  type StoredAnalyticsEvent,
} from "./analytics-ingestion";

export type AnalyticsContentInventoryItem = {
  slug: string;
  title: string;
  kind: AnalyticsContentKind;
  published_at?: string;
};

export type AnalyticsPublicTopPost = {
  slug: string;
  title: string;
  kind: AnalyticsContentKind;
  views: number;
  display_views: number | null;
  suppressed: boolean;
  interactions: number;
  last_event_at?: string;
};

export type AnalyticsPublicSummary = {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  generated_at: string;
  window_days: number;
  source: "live-jsonl" | "content-inventory" | "external-summary";
  total_events: number;
  total_post_views: number;
  event_counts: Partial<Record<AnalyticsEventTypeV1, number>>;
  top_posts: AnalyticsPublicTopPost[];
  content_inventory: {
    total_posts: number;
    posts_by_kind: Partial<Record<AnalyticsContentKind, number>>;
    latest_published_at?: string;
  };
  privacy_contract: {
    raw_ip: "not_collected";
    raw_user_agent: "not_collected";
    raw_question: "not_collected";
    session_ids: "not_exposed";
    small_bucket_threshold: number;
  };
};

export type AnalyticsOpsSummary = {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  generated_at: string;
  public_summary: AnalyticsPublicSummary;
  ingestion_health: {
    status: "ready" | "no_events";
    total_events: number;
    last_event_at?: string;
  };
  rejected_reasons: Record<string, number>;
  recent_events: Array<{
    received_at: string;
    event_type: AnalyticsEventTypeV1;
    content_slug: string;
    content_kind: AnalyticsContentKind;
    request_id: string;
  }>;
  access_boundary: {
    recommended: "cloudflare-access";
    fallback: "server-side-bearer-token";
    giscus_oauth_shared: false;
  };
};

const DEFAULT_WINDOW_DAYS = 30;
const SMALL_BUCKET_THRESHOLD = 3;
const INTERACTION_EVENT_TYPES = new Set<AnalyticsEventTypeV1>([
  "scroll_depth",
  "section_engagement",
  "code_copy",
  "toc_interaction",
  "tts_interaction",
  "presentation_interaction",
  "qa_interaction",
]);

function inventoryBySlug(inventory: AnalyticsContentInventoryItem[]) {
  return new Map(inventory.map((item) => [item.slug, item]));
}

function inventorySummary(inventory: AnalyticsContentInventoryItem[]) {
  const postsByKind: Partial<Record<AnalyticsContentKind, number>> = {};
  let latestPublishedAt: string | undefined;

  for (const item of inventory) {
    postsByKind[item.kind] = (postsByKind[item.kind] ?? 0) + 1;
    if (
      item.published_at &&
      (!latestPublishedAt || item.published_at > latestPublishedAt)
    ) {
      latestPublishedAt = item.published_at;
    }
  }

  return {
    total_posts: inventory.length,
    posts_by_kind: postsByKind,
    ...(latestPublishedAt ? { latest_published_at: latestPublishedAt } : {}),
  };
}

function withinWindow(
  row: StoredAnalyticsEvent,
  generatedAt: string,
  windowDays: number,
) {
  const generatedTime = Date.parse(generatedAt);
  const receivedTime = Date.parse(row.received_at);
  if (!Number.isFinite(generatedTime) || !Number.isFinite(receivedTime)) {
    return true;
  }
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return (
    receivedTime >= generatedTime - windowMs && receivedTime <= generatedTime
  );
}

export function buildPublicAnalyticsSummary({
  rows,
  inventory,
  generatedAt,
  windowDays = DEFAULT_WINDOW_DAYS,
  source = rows.length > 0 ? "live-jsonl" : "content-inventory",
}: {
  rows: StoredAnalyticsEvent[];
  inventory: AnalyticsContentInventoryItem[];
  generatedAt: string;
  windowDays?: number;
  source?: AnalyticsPublicSummary["source"];
}): AnalyticsPublicSummary {
  const visibleRows = rows.filter((row) =>
    withinWindow(row, generatedAt, windowDays),
  );
  const bySlug = inventoryBySlug(inventory);
  const eventCounts: Partial<Record<AnalyticsEventTypeV1, number>> = {};
  const postStats = new Map<
    string,
    {
      views: number;
      interactions: number;
      last_event_at?: string;
    }
  >();

  for (const row of visibleRows) {
    const eventType = row.event.event_type;
    const slug = row.event.content.content_slug;
    eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;
    const stats = postStats.get(slug) ?? { views: 0, interactions: 0 };
    if (eventType === "post_view") stats.views += 1;
    if (INTERACTION_EVENT_TYPES.has(eventType)) stats.interactions += 1;
    if (!stats.last_event_at || row.received_at > stats.last_event_at) {
      stats.last_event_at = row.received_at;
    }
    postStats.set(slug, stats);
  }

  const topPosts = Array.from(postStats.entries())
    .map(([slug, stats]) => {
      const content = bySlug.get(slug);
      const suppressed =
        stats.views > 0 && stats.views < SMALL_BUCKET_THRESHOLD;
      return {
        slug,
        title: content?.title ?? slug,
        kind: content?.kind ?? rowKindFallback(rows, slug),
        views: stats.views,
        display_views: suppressed ? null : stats.views,
        suppressed,
        interactions: stats.interactions,
        ...(stats.last_event_at ? { last_event_at: stats.last_event_at } : {}),
      } satisfies AnalyticsPublicTopPost;
    })
    .sort((a, b) => b.views - a.views || b.interactions - a.interactions)
    .slice(0, 8);

  return {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    generated_at: generatedAt,
    window_days: windowDays,
    source,
    total_events: visibleRows.length,
    total_post_views: eventCounts.post_view ?? 0,
    event_counts: eventCounts,
    top_posts: topPosts,
    content_inventory: inventorySummary(inventory),
    privacy_contract: {
      raw_ip: "not_collected",
      raw_user_agent: "not_collected",
      raw_question: "not_collected",
      session_ids: "not_exposed",
      small_bucket_threshold: SMALL_BUCKET_THRESHOLD,
    },
  };
}

function rowKindFallback(
  rows: StoredAnalyticsEvent[],
  slug: string,
): AnalyticsContentKind {
  return (
    rows.find((row) => row.event.content.content_slug === slug)?.event.content
      .content_kind ?? "blog_post"
  );
}

export function buildOpsAnalyticsSummary({
  rows,
  inventory,
  generatedAt,
  rejectedReasons = {},
  windowDays = DEFAULT_WINDOW_DAYS,
}: {
  rows: StoredAnalyticsEvent[];
  inventory: AnalyticsContentInventoryItem[];
  generatedAt: string;
  rejectedReasons?: Record<string, number>;
  windowDays?: number;
}): AnalyticsOpsSummary {
  const publicSummary = buildPublicAnalyticsSummary({
    rows,
    inventory,
    generatedAt,
    windowDays,
    source: rows.length > 0 ? "live-jsonl" : "content-inventory",
  });
  const sortedRows = [...rows].sort((a, b) =>
    b.received_at.localeCompare(a.received_at),
  );
  const lastEventAt = sortedRows[0]?.received_at;

  return {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    generated_at: generatedAt,
    public_summary: publicSummary,
    ingestion_health: {
      status: rows.length > 0 ? "ready" : "no_events",
      total_events: rows.length,
      ...(lastEventAt ? { last_event_at: lastEventAt } : {}),
    },
    rejected_reasons: rejectedReasons,
    recent_events: sortedRows.slice(0, 20).map((row) => ({
      received_at: row.received_at,
      event_type: row.event.event_type,
      content_slug: row.event.content.content_slug,
      content_kind: row.event.content.content_kind,
      request_id: row.request_id,
    })),
    access_boundary: {
      recommended: "cloudflare-access",
      fallback: "server-side-bearer-token",
      giscus_oauth_shared: false,
    },
  };
}
