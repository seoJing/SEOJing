import type { Metadata } from "vinext/shims/metadata";

import { MdxReviewQueue } from "@/widgets/ops-articles/MdxReviewQueue";
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

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 text-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-10">
      <section className="sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white/80 sm:p-6 sm:shadow-sm sm:dark:border-zinc-800 sm:dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Internal ops · Cloudflare Access 보호 전제
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          SEOJing 글 운영
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          `/ops/articles`는 공개 블로그가 아니라 진규 전용 운영면입니다. 새 글은
          CMS block revision으로 작성하고, 기존 MDX 글은 호환 모드로 함께
          운영합니다. 발행 시 public DB body가 갱신됩니다.
        </p>
      </section>

      <section className="mt-6 space-y-6">
        <aside className="sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white/80 sm:p-5 sm:dark:border-zinc-800 sm:dark:bg-zinc-950/70">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">글 선택</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                새 CMS 글은 아래 전체 폭 작성부에서 만듭니다. 기존 MDX 글은 Git
                기반 legacy 경로로 유지합니다.
              </p>
            </div>
            <form
              className="flex w-full max-w-xl flex-wrap items-end gap-2"
              action="/ops/articles"
            >
              <label className="min-w-60 flex-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                slug 직접 입력
                <input
                  name="slug"
                  defaultValue={selectedSlug}
                  placeholder="study/javascript-quizbook/day7"
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 sm:rounded-2xl sm:px-4 sm:py-3"
                />
              </label>
              <button className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
                열기
              </button>
            </form>
          </div>
        </aside>

        <OpsArticleEditor selectedSlug={selectedSlug} />
        <MdxReviewQueue selectedSlug={selectedSlug} />
      </section>
    </main>
  );
}
