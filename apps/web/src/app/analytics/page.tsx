import type { Metadata } from "vinext/shims/metadata";
import { loadPublicAnalyticsSummary } from "@/shared/analytics/analytics-dashboard-data";

export const metadata: Metadata = {
  title: "SEOJing Analytics",
  description:
    "SEOJing 글 읽기 경험을 공개 가능한 집계 지표로 보여주는 포트폴리오형 대시보드입니다.",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    blog_post: "Blog",
    study_post: "Study",
    okayjing_post: "OkayJing",
    devlog_post: "Devlog",
    page: "Page",
  };
  return labels[kind] ?? kind;
}

function sourceLabel(source: string) {
  if (source === "external-summary") return "실제 집계 스냅샷";
  if (source === "live-jsonl") return "실시간 JSONL 집계";
  return "콘텐츠 인벤토리 기준 준비 상태";
}

export default async function AnalyticsPage() {
  const summary = await loadPublicAnalyticsSummary();
  const hasLiveData = summary.total_events > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-950 dark:text-zinc-50">
      <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Public analytics · {sourceLabel(summary.source)}
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              SEOJing이 실제로 읽히는 방식을 공개 가능한 지표로 정리합니다.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
              이 페이지는 포트폴리오로 공개해도 되는 집계만 보여줍니다. IP, 원문
              User-Agent, 질문 원문, 세션별 이동 경로는 노출하지 않고, 작은
              표본은 숫자를 숨깁니다.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Privacy contract
            </p>
            <ul className="mt-3 space-y-2">
              <li>raw IP: {summary.privacy_contract.raw_ip}</li>
              <li>raw User-Agent: {summary.privacy_contract.raw_user_agent}</li>
              <li>raw Q&A question: {summary.privacy_contract.raw_question}</li>
              <li>session id: {summary.privacy_contract.session_ids}</li>
              <li>
                small bucket: &lt;{" "}
                {summary.privacy_contract.small_bucket_threshold}건 숫자 숨김
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="최근 집계 이벤트" value={summary.total_events} />
        <MetricCard label="글 조회 이벤트" value={summary.total_post_views} />
        <MetricCard
          label="콘텐츠 수"
          value={summary.content_inventory.total_posts}
        />
        <MetricCard
          label="집계 기간"
          value={`${summary.window_days}일`}
          numeric={false}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Top posts
              </p>
              <h2 className="mt-1 text-2xl font-semibold">많이 읽힌 글</h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              generated: {summary.generated_at.slice(0, 10)}
            </p>
          </div>

          {summary.top_posts.length > 0 ? (
            <ol className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
              {summary.top_posts.map((post, index) => (
                <li key={post.slug} className="py-4">
                  <a
                    className="group grid gap-3 md:grid-cols-[2rem_1fr_auto] md:items-center"
                    href={`/blog/${post.slug}`}
                  >
                    <span className="text-sm font-semibold text-zinc-400">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block font-medium group-hover:underline">
                        {post.title}
                      </span>
                      <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                        {kindLabel(post.kind)} · {post.interactions}{" "}
                        interactions
                      </span>
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-900">
                      {post.display_views === null
                        ? `< ${summary.privacy_contract.small_bucket_threshold}`
                        : formatNumber(post.display_views)}{" "}
                      views
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              아직 공개할 수 있는 집계 스냅샷이 없습니다. 수집/집계 연결
              전까지는 콘텐츠 인벤토리와 privacy contract만 노출합니다.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Content inventory
          </p>
          <h2 className="mt-1 text-2xl font-semibold">분류별 글 수</h2>
          <dl className="mt-5 space-y-3">
            {Object.entries(summary.content_inventory.posts_by_kind).map(
              ([kind, count]) => (
                <div
                  key={kind}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900/70"
                >
                  <dt>{kindLabel(kind)}</dt>
                  <dd className="font-semibold">{formatNumber(count ?? 0)}</dd>
                </div>
              ),
            )}
          </dl>
          <div className="mt-5 rounded-2xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100 dark:bg-white dark:text-zinc-950">
            공개 대시보드는 SEOJing의 운영 성숙도를 보여주는 포트폴리오
            표면입니다. 원자료 확인, rejected event, storage 상태는 내부용
            `/ops/analytics`에서 분리해서 봅니다.
          </div>
        </div>
      </section>

      {!hasLiveData ? (
        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          현재 상태는 “공개 페이지 scaffold + 콘텐츠 인벤토리 fallback”입니다.
          실제 수집 JSONL 또는 public summary URL이 연결되면 같은 화면에 집계가
          채워집니다.
        </section>
      ) : null}
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
      <p className="mt-2 text-3xl font-bold">
        {numeric && typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}
