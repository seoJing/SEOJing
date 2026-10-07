import type { Metadata } from "vinext/shims/metadata";

import { OpsArticlesHome } from "@/widgets/ops-articles/OpsArticlesHome";

export const metadata: Metadata = {
  title: "SEOJing 글 목록",
  robots: { index: false, follow: false },
};

export default function OpsArticlesPage() {
  return (
    <main className="mx-auto max-w-7xl px-3 py-6 text-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">SEOJing · 글 운영</p>
          <h1 className="mt-1 text-3xl font-bold">글 목록</h1>
        </div>
        <a
          href="/ops/articles/edit"
          className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950"
        >
          새 글 작성
        </a>
      </header>
      <OpsArticlesHome />
    </main>
  );
}
