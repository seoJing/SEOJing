import type { Metadata } from "vinext/shims/metadata";

import { OpsArticleEditor } from "@/widgets/ops-articles/OpsArticleEditor";
import { OpsArticleStepper } from "@/widgets/ops-articles/OpsArticleStepper";

export const metadata: Metadata = {
  title: "SEOJing 글 편집",
  robots: { index: false, follow: false },
};

export default async function OpsArticleEditPage({
  searchParams,
}: {
  searchParams?: Promise<{ slug?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedSlug = params.slug?.trim() ?? "";
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 text-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-10">
      <header className="mb-6">
        <a
          href="/ops/articles"
          className="text-sm text-zinc-500 underline underline-offset-4"
        >
          ← 글 목록
        </a>
        <h1 className="mt-3 text-3xl font-bold">
          {selectedSlug ? "글 편집" : "새 글 작성"}
        </h1>
        {selectedSlug ? (
          <form
            action="/ops/articles/edit"
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <label className="min-w-64 flex-1 text-sm font-medium">
              글 선택 · slug
              <input
                name="slug"
                defaultValue={selectedSlug}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
              열기
            </button>
          </form>
        ) : null}
      </header>
      <OpsArticleEditor selectedSlug={selectedSlug} />
      {selectedSlug ? <OpsArticleStepper slug={selectedSlug} /> : null}
    </main>
  );
}
