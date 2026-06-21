import type { Metadata } from "vinext/shims/metadata";
import { loadOpsAnalyticsSummary } from "@/shared/analytics/analytics-dashboard-data";

export const metadata: Metadata = {
  title: "SEOJing Ops Analytics",
  robots: { index: false, follow: false },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function authLabel() {
  return "Cloudflare Access 보호 권장 · GitHub OAuth 직접 구현은 후순위";
}

export default async function OpsAnalyticsPage() {
  const summary = await loadOpsAnalyticsSummary();
  const rejectedTotal = Object.values(summary.rejected_reasons).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-950 dark:text-zinc-50">
      <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Internal ops · {authLabel()}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          SEOJing analytics 운영 상태
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          이 페이지는 `/ops/*` 경로를 Cloudflare Access로 보호한 뒤 보는 내부용
          화면입니다. Giscus의 GitHub 로그인은 iframe 내부 인증이라 SEOJing 앱
          세션으로 공유되지 않으므로, 내부 접근 제어는 Access 또는 서버 사이드
          토큰으로 분리합니다.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="ingestion status"
          value={summary.ingestion_health.status}
          numeric={false}
        />
        <MetricCard
          label="stored events"
          value={summary.ingestion_health.total_events}
        />
        <MetricCard label="rejected" value={rejectedTotal} />
        <MetricCard
          label="last event"
          value={summary.ingestion_health.last_event_at?.slice(0, 19) ?? "없음"}
          numeric={false}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Boundary
          </p>
          <h2 className="mt-1 text-2xl font-semibold">접근 방식</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <p>
              추천: `/ops/*`와 내부 summary API를 Cloudflare Access 뒤에 둡니다.
              진규 GitHub/email만 허용하면 앱 코드에 OAuth 세션을 직접 넣지
              않아도 웹에서 바로 접근할 수 있습니다.
            </p>
            <p>
              fallback: origin API에는 서버 사이드 bearer token을 둘 수
              있습니다. 이 값은 browser bundle이나 공개 env에 넣지 않습니다.
            </p>
            <p>
              Giscus OAuth 공유 여부:{" "}
              {String(summary.access_boundary.giscus_oauth_shared)}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Public projection
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            공개 화면으로 나가는 값
          </h2>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoPill
              label="events"
              value={formatNumber(summary.public_summary.total_events)}
            />
            <InfoPill
              label="post views"
              value={formatNumber(summary.public_summary.total_post_views)}
            />
            <InfoPill
              label="small bucket"
              value={`< ${summary.public_summary.privacy_contract.small_bucket_threshold}`}
            />
          </dl>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Rejected reasons
          </p>
          <h2 className="mt-1 text-2xl font-semibold">거절된 이벤트</h2>
          {Object.keys(summary.rejected_reasons).length > 0 ? (
            <dl className="mt-5 space-y-3">
              {Object.entries(summary.rejected_reasons).map(
                ([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900/70"
                  >
                    <dt>{reason}</dt>
                    <dd className="font-semibold">{formatNumber(count)}</dd>
                  </div>
                ),
              )}
            </dl>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              아직 rejected summary가 없습니다. origin read endpoint 또는 ops
              summary URL이 연결되면 reason/count만 표시합니다. rejected payload
              전문은 저장하지 않습니다.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent sanitized events
          </p>
          <h2 className="mt-1 text-2xl font-semibold">최근 이벤트 샘플</h2>
          {summary.recent_events.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">received</th>
                    <th className="py-2 pr-3">event</th>
                    <th className="py-2 pr-3">slug</th>
                    <th className="py-2 pr-3">request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {summary.recent_events.map((event) => (
                    <tr key={`${event.request_id}-${event.received_at}`}>
                      <td className="py-3 pr-3">
                        {event.received_at.slice(0, 19)}
                      </td>
                      <td className="py-3 pr-3">{event.event_type}</td>
                      <td className="py-3 pr-3">{event.content_slug}</td>
                      <td className="py-3 pr-3">{event.request_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              최근 이벤트가 없습니다. 이 표에도 session id, raw question, raw
              User-Agent, IP는 표시하지 않습니다.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  numeric = true,
}: {
  label: string;
  value: number | string;
  numeric?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">
        {numeric && typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/70">
      <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}
