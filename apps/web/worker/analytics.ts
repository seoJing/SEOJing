import { handleAnalyticsCollectRequest } from "../src/shared/analytics/analytics-collect-api";
import type { StoredAnalyticsEvent } from "../src/shared/analytics/analytics-ingestion";
import { getAnalyticsContentInventory } from "../src/shared/analytics/analytics-dashboard-data";
import { buildOpsAnalyticsSummary } from "../src/shared/analytics/analytics-summary";
import { isOpsAuthorized } from "./ops-access";

type AnalyticsEnv = Env & { SEOJING_OPS_ACCESS_EMAIL?: string };

function json(status: number, value: unknown): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function handleAnalyticsRequest(
  request: Request,
  env: AnalyticsEnv,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/analytics/events") {
    if (request.method === "POST") {
      const key = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.ANALYTICS_LIMITER.limit({ key });
      if (!success) return json(429, { ok: false, error: "rate_limited" });
    }
    return handleAnalyticsCollectRequest(request, {
      allowedOrigins: [
        "https://seojing.com",
        "https://www.seojing.com",
        "http://localhost:3000",
      ],
      storage: {
        async append(rows: StoredAnalyticsEvent[]) {
          await env.ANALYTICS_DB.batch(
            rows.map((row) =>
              env.ANALYTICS_DB.prepare(
                "INSERT OR IGNORE INTO analytics_events(event_id, received_at, content_slug, event_type, row_json) VALUES (?, ?, ?, ?, ?)",
              ).bind(
                row.event.event_id,
                row.received_at,
                row.event.content.content_slug,
                row.event.event_type,
                JSON.stringify(row),
              ),
            ),
          );
        },
      },
    });
  }

  if (pathname === "/api/ops/analytics/summary") {
    if (request.method !== "GET")
      return json(405, { ok: false, error: "method_not_allowed" });
    if (!(await isOpsAuthorized(request, env))) {
      return json(401, { ok: false, error: "access_required" });
    }
    const from = new Date(Date.now() - 30 * 86400_000).toISOString();
    const result = await env.ANALYTICS_DB.prepare(
      "SELECT row_json FROM analytics_events WHERE received_at >= ? ORDER BY received_at DESC LIMIT 20001",
    )
      .bind(from)
      .all<{ row_json: string }>();
    if (result.results.length > 20000)
      return json(503, { ok: false, error: "summary_limit_exceeded" });
    const rows = result.results.map(
      (item) => JSON.parse(item.row_json) as StoredAnalyticsEvent,
    );
    return json(
      200,
      buildOpsAnalyticsSummary({
        rows,
        inventory: getAnalyticsContentInventory(),
        generatedAt: new Date().toISOString(),
        source: "live-d1",
      }),
    );
  }

  return json(404, { ok: false, error: "not_found" });
}

export async function purgeExpiredAnalytics(env: AnalyticsEnv): Promise<void> {
  const before = new Date(Date.now() - 30 * 86400_000).toISOString();
  await env.ANALYTICS_DB.prepare(
    "DELETE FROM analytics_events WHERE received_at < ?",
  )
    .bind(before)
    .run();
}
