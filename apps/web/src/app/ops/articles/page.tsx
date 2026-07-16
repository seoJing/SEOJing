import type { Metadata } from "vinext/shims/metadata";

import { getAnalyticsContentInventory } from "@/shared/analytics/analytics-dashboard-data";
import { OpsArticleEditor } from "@/widgets/ops-articles/OpsArticleEditor";

export const metadata: Metadata = {
  title: "SEOJing Ops Articles",
  robots: { index: false, follow: false },
};

interface OpsArticlesPageProps {
  searchParams?: Promise<{ slug?: string }>;
}

export default async function OpsArticlesPage({
  searchParams,
}: OpsArticlesPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedSlug = params.slug?.trim() ?? "";
  const inventory = getAnalyticsContentInventory();
  const studyItems = inventory.filter((item) => item.kind === "study_post");
  const displayItems = selectedSlug
    ? inventory
    : [
        ...studyItems,
        ...inventory.filter((item) => item.kind !== "study_post"),
      ].slice(0, 36);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-zinc-950 dark:text-zinc-50">
      <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Internal ops · Cloudflare Access 보호 전제
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          SEOJing 글 운영
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          `/ops/articles`는 공개 블로그가 아니라 진규 전용 운영면입니다. 글은
          MDX source를 계속 authoring format으로 쓰되, 저장 시 backend article
          revision으로 들어가고 발행 시 public DB body가 갱신됩니다.
        </p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
            <h2 className="text-lg font-semibold">글 선택</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              현재 목록은 repo content inventory 기준입니다. 검색/페이지네이션은
              다음 단계에서 backend article list와 합치면 됩니다.
            </p>
            <form className="mt-4" action="/ops/articles">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                slug 직접 입력
                <input
                  name="slug"
                  defaultValue={selectedSlug}
                  placeholder="study/javascript-quizbook/day7"
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <button className="mt-3 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
                열기
              </button>
            </form>
          </div>

          <div className="max-h-[52rem] overflow-y-auto rounded-3xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
            {displayItems.map((item) => (
              <a
                key={item.slug}
                href={`/ops/articles?slug=${encodeURIComponent(item.slug)}`}
                className={`block rounded-2xl px-3 py-3 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                  item.slug === selectedSlug
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : ""
                }`}
              >
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </span>
                <span className="mt-1 block break-all text-xs text-zinc-500 dark:text-zinc-400">
                  {item.slug}
                </span>
              </a>
            ))}
          </div>
        </aside>

        <OpsArticleEditor selectedSlug={selectedSlug} />
      </section>
    </main>
  );
}
